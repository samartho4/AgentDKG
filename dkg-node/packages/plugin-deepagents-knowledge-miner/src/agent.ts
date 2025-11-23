import { v4 as uuidv4 } from "uuid";
import {
  createDeepAgent,
  type SubAgent,
  StateBackend,
} from "deepagents";

import {
  makeInternetSearchTool,
  makeDkgGetTool,
  makeDkgCreateTool,
  makeX402TrustScoreTool,
  type DkgPluginContext,
} from "./tools";

/**
 * Global token discipline.
 * This is intentionally tiny to stay well under the
 * Anthropic 30k input-tokens / min limit.
 */
const TOKEN_BUDGET_NOTE = `Be aggressively concise.
- Keep each message ≲ 200 tokens.
- Never repeat the task or earlier instructions.
- Never paste long web pages or raw JSON; only short summaries.
- Use bullets and short paragraphs.`;

// --------------------------------------------------------
// createKnowledgeMinerAgent
// --------------------------------------------------------

export function createKnowledgeMinerAgent(ctx: DkgPluginContext) {
  const internetSearch = makeInternetSearchTool(ctx);
  const dkgGet = makeDkgGetTool(ctx);
  const dkgCreate = makeDkgCreateTool(ctx);
  const x402TrustScore = makeX402TrustScoreTool();

  /**
   * SUBAGENT 1: ENRICHMENT
   *
   * Responsibilities
   * - Take a short task (and often a UAL embedded in the task).
   * - If a UAL is present, call dkg_get ONCE to inspect it.
   * - Use a FEW web searches to cross-check facts.
   * - Produce 2 files ONLY:
   *     /memories/knowledge/{{domain}}/report.md
   *     /memories/knowledge/{{domain}}/triples.md
   */
  const enrichmentSubagent: SubAgent = {
    name: "knowledge_enrichment",
    description:
      "Inspect one DKG asset plus web sources and write a short report + RDF-style triples.",
    systemPrompt: `${TOKEN_BUDGET_NOTE}

You are the ENRICHMENT subagent.

Goal:
- For a single task + optional UAL, combine DKG data and a few web sources
  into a compact report and a small set of RDF-style triples.

Very important rules:
- NEVER call write_todos or any todo-related tools.
- Use only these tools here:
  • dkg_get
  • internet_search
  • read_file / write_file (filesystem)
- Keep tool calls minimal and focused.

Assume optionally that the main agent gives you:
- a domain string like "supply-chain" or "general".
- a UAL embedded in the task text if available.

Workflow (single pass):

1) Parse domain and UAL
   - If the user task or earlier messages clearly contain a DKG UAL, note it.
   - If no UAL is obvious, you may skip dkg_get.

2) DKG inspection
   - If you have a UAL, call dkg_get AT MOST ONCE to see its JSON.
   - Do NOT paste raw JSON into messages; summarize in 5–10 bullets.

3) Web cross-check
   - Call internet_search up to 3 times.
   - For each search, pull only the key facts + 1–3 useful URLs.

4) Write TWO files only:
   - /memories/knowledge/{{domain}}/report.md
   - /memories/knowledge/{{domain}}/triples.md

   Where {{domain}} is:
   - the explicit domain from the task, or
   - "general" if not given.

   report.md structure (keep it tight):
   - Title line
   - "Key facts" (bullets, grouped logically)
   - "Supply / risk / impact" (if relevant)
   - "Evidence (URLs)" – a short bullet list of URLs
   - "Open questions" – at most 3 bullets

   triples.md:
   - 5–20 RDF-style triples, one per line, e.g.
     subject predicate object .

5) At the END of report.md, append a tiny JSON block:
   \`\`\`json
   { "uals": ["..."], "main_ual": "..." }
   \`\`\`

Constraints:
- Use EACH file path at most once with write_file (overwrite is fine).
- Keep each file ≲ 400 tokens.
- Do not create any other files.`,
    tools: [dkgGet as any, internetSearch as any],
  };

  /**
   * SUBAGENT 2: VALIDATION
   *
   * Responsibilities
   * - Read report.md + triples.md for the same domain.
   * - Use x402_trust_score a couple of times as a simulated signal.
   * - Append a compact validation section + final JSON block to report.md.
   */
  const validationSubagent: SubAgent = {
    name: "knowledge_validation",
    description:
      "Read report + triples, call x402_trust_score sparingly, and append a compact validation summary.",
    systemPrompt: `${TOKEN_BUDGET_NOTE}

You are the VALIDATION subagent.

Goal:
- Turn the enrichment output into a small validation layer with a single
  global trust score.

Inputs:
- /memories/knowledge/{{domain}}/report.md
- /memories/knowledge/{{domain}}/triples.md

(Use "general" for {{domain}} if no domain is given.)

Rules:
- NEVER call write_todos.
- Use tools:
  • read_file / write_file
  • x402_trust_score
- Keep all validation text very short and concrete.

Single validation pass:

1) Read files
   - Use read_file to load report.md and triples.md.
   - Identify 3–7 key claims and any UAL(s) mentioned in the JSON block.

2) Call x402_trust_score
   - Choose at most 2 UALs (or 1 if only one exists).
   - Call x402_trust_score once per chosen UAL with a short "reason".
   - Remember: this is a SIMULATED trust signal; treat it as one input
     among others (web evidence, internal consistency, etc.).

3) Compute a global_trust_score in [0, 1]
   - Blend:
     • strength of evidence from report + triples,
     • simulated x402 scores,
     • any obvious gaps or concerns.
   - You do not need complex math; simple reasoning is enough.

4) APPEND to report.md (do NOT create new files):
   - A "Validation summary" section:
     • Bullet list of well-supported claims.
     • Bullet list of weak / partially supported points.
   - A short line like:
     "Global trust score: 0.82 (high confidence in core facts, moderate in economic figures)."

5) At the very end of report.md, append a JSON block:
   \`\`\`json
   { "global_trust_score": 0.0-1.0 }
   \`\`\`

Keep the whole validation addition ≲ 250 tokens.
Do not overwrite the earlier report content; only append.`,
    tools: [x402TrustScore as any],
  };

  // -----------------------------
  // Memory backend
  // -----------------------------

  const backend = (config: { state: unknown; store?: any }) =>
    new StateBackend(config);

  // -----------------------------
  // Main Knowledge Miner agent
  // -----------------------------

  const systemPrompt = `${TOKEN_BUDGET_NOTE}

You are the MAIN KNOWLEDGE MINER.

You orchestrate TWO subagents inside a DeepAgents graph:
- "knowledge_enrichment"
- "knowledge_validation"

Your job is to run ONE clean pipeline for each user task:
  ENRICHMENT → VALIDATION → (optional) PUBLISH

Key ideas:
- The user task may include a DKG UAL and a domain string.
- You should keep everything focused on that ONE asset / topic.
- Use the existing tools; do NOT invent new ones.

Strict behavior for each run:

1) Domain + UAL parsing
   - If the user or tool input mentions "Domain: X", treat X as the domain.
   - Otherwise use "general".
   - If a UAL like "did:dkg:..." appears, keep it as the main UAL.

2) Subagent sequence (IMPORTANT)
   - Delegate to "knowledge_enrichment" exactly ONCE using the task tool.
   - After enrichment completes, delegate to "knowledge_validation" exactly ONCE.
   - NEVER call the same subagent twice.
   - NEVER call write_todos. Plan inline in natural language instead.

3) Optional publishing
   - ONLY if the task explicitly asks to create or update a Knowledge Asset:
     • Build a small JSON-LD object summarizing the validated facts.
     • Call dkg_create ONCE with that JSON-LD (privacy defaults to "private"
       unless the request clearly says "public").
   - If the task does not mention publishing, do NOT call dkg_create.

Token + tool discipline:
- Keep total tool calls (including subagents) as low as you reasonably can
  (aim for ≲ 15 per run).
- Always summarize tool results instead of dumping them.
- Prefer re-using:
  • /memories/knowledge/{{domain}}/report.md
  • /memories/knowledge/{{domain}}/triples.md

Final answer to the user:
- 2–4 short paragraphs summarizing:
  • key confirmed facts,
  • any partially validated items,
  • the final global_trust_score in [0,1] with a plain-language label
    (e.g., "high", "medium", "low" confidence).
- Mention the main report path so the UI can open it, e.g.
  "/memories/knowledge/supply-chain/report.md".`;

  const agent = createDeepAgent({
    systemPrompt,
    tools: [internetSearch, dkgGet, dkgCreate, x402TrustScore] as any,
    backend,
    subagents: [enrichmentSubagent, validationSubagent],

    interruptOn: {
      // Keep this simple; the plugin handles resume via knowledge_miner_resume
      tools: true,
    },
  });

  return agent;
}

// --------------------------------------------------------
// defaultThreadConfig
// --------------------------------------------------------

export function defaultThreadConfig() {
  return {
    configurable: {
      thread_id: uuidv4(),
    },
    /**
     * Recursion limit caps LangGraph / DeepAgents steps.
     * 60 gives a bit more room than 40 but is still small enough
     * to avoid runaway loops, especially with the tight prompts above.
     */
    recursionLimit: 60,
  };
}
