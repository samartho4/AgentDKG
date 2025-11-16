import { tool } from "@langchain/core/tools";
import { z } from "zod";

type DkgPluginContext = {
  dkg?: any;
  blob?: any;
};

// Internet search tool using Tavily API
export function makeInternetSearchTool(ctx: DkgPluginContext) {
  return tool(
    async ({ query }: { query: string }) => {
      // Use Tavily API if key is available
      if (process.env.TAVILY_API_KEY) {
        try {
          const response = await fetch("https://api.tavily.com/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              api_key: process.env.TAVILY_API_KEY,
              query,
              max_results: 5,
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

      return `Internet search for "${query}" - Tavily API key not configured.`;
    },
    {
      name: "internet_search",
      description:
        "Search the open web for up-to-date information. Always use this for discovery before drafting reports.",
      schema: z.object({
        query: z.string().describe("Detailed natural language query to search for."),
      }),
    }
  );
}

// DKG search tool
export function makeDkgSearchKAsTool(ctx: DkgPluginContext) {
  return tool(
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
      name: "dkg_search_kas",
      description:
        "Search existing Knowledge Assets in the DKG and return matching UALs plus minimal metadata.",
      schema: z.object({
        query: z.string().describe("Text query for KAs."),
        tag: z.string().optional().describe("Optional domain tag."),
      }),
    }
  );
}

// DKG link tool
export function makeDkgLinkKAsTool(ctx: DkgPluginContext) {
  return tool(
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

      return JSON.stringify(
        {
          kind: "link_instruction",
          sourceUal,
          targetUals,
          relation,
        },
        null,
        2
      );
    },
    {
      name: "dkg_link_kas",
      description:
        "Propose linking a 'source' Knowledge Asset to one or more 'target' KAs via UALs.",
      schema: z.object({
        sourceUal: z.string().describe("UAL of the KA being enriched."),
        targetUals: z.array(z.string()).describe("UALs of existing KAs to link to."),
        relation: z.string().describe("Semantic link predicate."),
      }),
    }
  );
}

// x402 trust score tool
export function makeX402TrustScoreTool() {
  return tool(
    async ({ ual, reason }: { ual: string; reason: string }) => {
      // TODO: replace with real x402 / NeuroWeb economics call
      return {
        ual,
        reason,
        score: 0.78,
        comment:
          "Simulated x402 trust score based on publisher reputation and link density. Replace with real implementation.",
      };
    },
    {
      name: "x402_trust_score",
      description:
        "Simulate an x402 trust / economic signal for a given KA UAL and reason. Use near the end of validation.",
      schema: z.object({
        ual: z.string().describe("UAL of the knowledge asset being evaluated."),
        reason: z.string().describe("Why this asset is being scored."),
      }),
    }
  );
}
