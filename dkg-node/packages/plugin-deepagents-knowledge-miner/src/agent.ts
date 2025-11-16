import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { createDeepAgent } from "deepagents";
import { v4 as uuidv4 } from "uuid";

// Type for the plugin context
type DkgPluginContext = {
  dkg?: any;
  blob?: any;
};

// ---------- Tools ----------

// 1) Web search (using Tavily or fallback to fetch)
const internetSearch = (ctx: DkgPluginContext) =>
  tool(
    async ({ query, maxResults }: { query: string; maxResults?: number }) => {
      // If Tavily API key is available, use it
      if (process.env.TAVILY_API_KEY) {
        try {
          const url = new URL("https://api.tavily.com/search");
          const response = await fetch(url.toString(), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              api_key: process.env.TAVILY_API_KEY,
              query,
              max_results: maxResults || 5,
            }),
          });

          if (!response.ok) {
            return `internet_search failed with status ${response.status}`;
          }

          const json = await response.json();
          return JSON.stringify(json, null, 2);
        } catch (err: any) {
          return `internet_search error: ${err?.message ?? String(err)}`;
        }
      }

      // Fallback: return a message
      return `Internet search for "${query}" - Tavily API key not configured. Please set TAVILY_API_KEY environment variable.`;
    },
    {
      name: "internet_search",
      description:
        "Search the web for up-to-date information, reports, and references. Use this when you need context outside the DKG.",
      schema: z.object({
        query: z.string().describe("Search query string."),
        maxResults: z.number().int().positive().optional(),
      }),
    },
  );

// 2) DKG search for existing KAs (for discovery + linking)
const dkgSearchKAs = (ctx: DkgPluginContext) =>
  tool(
    async ({ query, tag }: { query: string; tag?: string }) => {
      if (!ctx.dkg) return "DKG client not available in plugin context.";

      try {
        const result = await (ctx.dkg as any).searchKnowledgeAssets({
          query,
          tag,
          limit: 10,
        });
        return JSON.stringify(result, null, 2);
      } catch (err: any) {
        return `DKG search failed: ${err?.message ?? String(err)}`;
      }
    },
    {
      name: "dkg_search_knowledge_assets",
      description:
        "Search existing Knowledge Assets in the DKG and return matching UALs plus minimal metadata.",
      schema: z.object({
        query: z
          .string()
          .describe("Text query or SPARQL-like search string for KAs."),
        tag: z
          .string()
          .optional()
          .describe("Optional domain tag such as 'supply-chain'."),
      }),
    },
  );

// 3) Propose linking new KAs to existing ones via UALs
const dkgLinkKAs = (ctx: DkgPluginContext) =>
  tool(
    async ({
      sourceUal,
      targetUals,
      relation,
    }: {
      sourceUal: string;
      targetUals: string[];
      relation: string;
    }) => {
      if (!ctx.dkg) return "DKG client not available in plugin context.";

      // We only emit a *proposed* link instruction; actual publishing
      // will be handled by the KA pipeline after human approval.
      return JSON.stringify(
        {
          kind: "link_instruction",
          sourceUal,
          targetUals,
          relation,
        },
        null,
        2,
      );
    },
    {
      name: "dkg_link_knowledge_assets",
      description:
        "Propose linking a 'source' Knowledge Asset to one or more 'target' KAs via UALs.",
      schema: z.object({
        sourceUal: z
          .string()
          .describe(
            "UAL of the KA being enriched (e.g. a new supply-chain risk statement).",
          ),
        targetUals: z
          .array(z.string())
          .describe("UALs of existing high-quality KAs to link to."),
        relation: z
          .string()
          .describe("Ontology-style predicate describing the semantic link."),
      }),
    },
  );

// 4) x402-style trust / incentive simulation (no real payments)
const x402SimulatePayment = tool(
  async ({
    amount,
    tokenSymbol,
    reason,
  }: {
    amount: number;
    tokenSymbol: string;
    reason?: string;
  }) => {
    return {
      kind: "x402_simulation",
      tokenSymbol,
      amount,
      reason,
      simulatedTxHash: `0xsimulated-${Math.random()
        .toString(16)
        .slice(2, 10)}`,
    };
  },
  {
    name: "x402_simulate_payment",
    description:
      "Simulate an x402-style token payment for a KA or action. Use this to reason about incentives and trust before real settlements.",
    schema: z.object({
      amount: z.number().positive().describe("Nominal amount (simulation only)."),
      tokenSymbol: z.string().describe("Token symbol, e.g. TRAC, USDC."),
      reason: z
        .string()
        .optional()
        .describe("Short description of why this simulated payment is made."),
    }),
  },
);

// ---------- Agent factory ----------

export function createKnowledgeMinerAgent(ctx: DkgPluginContext) {
  const systemPrompt = `
You are a Knowledge Miner agent. For EVERY research task, follow this workflow:

## REQUIRED Steps (do ALL of these):

1. **Plan**: write_todos(["Search web for X", "Search DKG for related KAs", "Analyze findings", "Save to memory"])

2. **Web Research**: internet_search("your query") - gather current information

3. **DKG Search**: dkg_search_knowledge_assets(query="related topic", tag="domain") - find existing knowledge

4. **Save Research**: write_file("/memories/knowledge/{domain}/research.md", "your findings")

5. **Link Knowledge**: dkg_link_knowledge_assets(sourceUal="new-ka", targetUals=["existing-ka"], relation="relatedTo")

6. **Use Subagents**: For complex subtasks, delegate using the task tool:
   - task(task="Analyze specific aspect", instructions="detailed analysis")

7. **Update Todos**: write_todos with updated progress as you complete steps

## Example Full Workflow:
- write_todos(["Web search", "DKG search", "Analysis", "Save results"])
- internet_search("TSMC supply chain")
- dkg_search_knowledge_assets(query="supply chain risks", tag="supply-chain")
- task(task="Analyze geopolitical risks", instructions="Focus on Taiwan-China tensions")
- write_file("/memories/knowledge/supply-chain/tsmc-analysis.md", "findings here")
- dkg_link_knowledge_assets(sourceUal="new", targetUals=["existing"], relation="relatedTo")
- write_todos(["All complete"])

CRITICAL: You MUST use ALL these tools (write_todos, internet_search, dkg_search_knowledge_assets, write_file, task) to demonstrate the full workflow.
`.trim();

  // Configure model - DeepAgents will auto-detect from environment variables
  // It looks for ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_API_KEY
  // and uses the appropriate default model
  
  // createDeepAgent returns a compiled graph, not a builder
  // It automatically includes TodoListMiddleware, FilesystemMiddleware, and SubAgentMiddleware
  const agent = createDeepAgent({
    instructions: systemPrompt,
    tools: [
      internetSearch(ctx),
      dkgSearchKAs(ctx),
      dkgLinkKAs(ctx),
      x402SimulatePayment,
    ],
  });

  return agent;
}

export function defaultThreadConfig() {
  return {
    configurable: {
      thread_id: uuidv4(),
    },
    recursionLimit: 100, // Increase from default 25 to allow more complex research tasks
  };
}
