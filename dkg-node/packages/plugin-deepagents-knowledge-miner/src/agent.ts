import { v4 as uuidv4 } from "uuid";
import {
  createDeepAgent,
  type SubAgent,
  CompositeBackend,
  StateBackend,
  StoreBackend,
} from "deepagents";
import {
  makeInternetSearchTool,
  makeDkgSearchKAsTool,
  makeDkgLinkKAsTool,
  makeX402TrustScoreTool,
} from "./tools";

// Type for the plugin context
type DkgPluginContext = {
  dkg?: any;
  blob?: any;
};

export function createKnowledgeMinerAgent(ctx: DkgPluginContext) {
  const internetSearch = makeInternetSearchTool(ctx);
  const dkgSearchKAs = makeDkgSearchKAsTool(ctx);
  const dkgLinkKAs = makeDkgLinkKAsTool(ctx);
  const x402TrustScore = makeX402TrustScoreTool();

  // ---------- Subagents ----------
  const discoverySubagent: SubAgent = {
    name: "knowledge_discovery",
    description:
      "Specialized in planning and research. Uses web_search and filesystem to gather raw material.",
    systemPrompt: `You are the *Discovery* subagent in a knowledge-mining pipeline.
Your responsibilities:
- Write a clear to-do list with the write_todos tool before deep work.
- Use the internet_search tool to gather diverse, high-quality sources.
- Save raw notes and source lists under:
  - /memories/research/sources.txt
  - /memories/research/notes.txt
- Avoid final conclusions; focus on breadth and evidence collection.`,
    tools: [internetSearch as any],
  };

  const enrichmentSubagent: SubAgent = {
    name: "knowledge_enrichment",
    description:
      "Connects new insights to existing Knowledge Assets, proposes UAL links and enrichment.",
    systemPrompt: `You are the *Enrichment* subagent.
Given draft findings and existing DKG Knowledge Assets:
- Call dkg_search_kas to find high-quality, relevant KAs.
- Propose link structures and UALs connecting new knowledge to these assets.
- Write your linking plan to /memories/knowledge/linking_plan.md as markdown.
- Output a concise JSON summary with fields:
  - new_asset_candidates: [...]
  - linked_uals: [...]
  - justification: "why these links make sense"`,
    tools: [dkgSearchKAs as any, dkgLinkKAs as any],
  };

  const validationSubagent: SubAgent = {
    name: "knowledge_validation",
    description:
      "Stress-tests findings, estimates confidence, and triggers trust / tokenomics tools.",
    systemPrompt: `You are the *Validation* subagent.
Responsibilities:
- Challenge assumptions, look for failure modes and conflicting evidence.
- Assign confidence scores (0-1) per key claim.
- Optionally call x402_trust_score to compute an economic/credibility signal.
- Save a structured critique in /memories/knowledge/validation_notes.md.`,
    tools: [x402TrustScore as any],
  };

  // ---------- Long-term memory backend (/memories/) ----------
  // Use StateBackend for all paths since we don't have a persistent store configured
  // Files will be stored in agent state (ephemeral per-thread)
  const backend = (config: { state: unknown; store?: any }) =>
    new StateBackend(config);

  const systemPrompt = `You are the *Knowledge Miner* supervising a Deep Agent knowledge-mining pipeline.

High-level phases:
1. PLAN with a to-do list using write_todos.
2. DISCOVER with the knowledge_discovery subagent and internet_search.
3. ENRICH with the knowledge_enrichment subagent, linking to existing KAs via UALs.
4. VALIDATE with the knowledge_validation subagent and x402_trust_score.
5. PUBLISH: create / update DKG Knowledge Assets and write final report.

Filesystem and workspace:
- Use /memories/research/ for raw sources and notes.
- Use /memories/knowledge/<domain>/ for refined reports, link plans, and validation notes.
- These paths are long-term memory and must be reused across sessions.

After validation, call x402_trust_score for the most important KA UALs.
Include a "Trust & Tokenomics" section in the final report that explains:
- Which KAs were scored
- Their scores and quick interpretation
- How these scores influence overall confidence

Always end by:
- Writing a final markdown report to /memories/knowledge/<domain>/<slug>-research.md
- Returning a clean natural-language summary for the user.
- Including in your text the path to the main report file.`;

  // Agent with DeepAgents features (todos, memory) but optimized for speed
  const agent = createDeepAgent({
    systemPrompt: `You are a Knowledge Miner. When given a research task:

1. PLAN: Use write_todos to create a simple 2-3 step plan
2. RESEARCH: Use internet_search ONCE with a focused query
3. DOCUMENT: Save your findings to /memories/knowledge/<domain>/report.md
4. RESPOND: Provide a concise summary (2-3 paragraphs)

IMPORTANT: 
- Only make ONE internet search call
- Keep todos simple (2-3 items max)
- Save one report file to /memories/knowledge/<domain>/report.md
- Be fast and concise`,
    tools: [internetSearch],
    model: "claude-sonnet-4-20250514",
    backend,
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
