import { v4 as uuidv4 } from "uuid";
import {
  createDeepAgent,
  type SubAgent,
  StateBackend,
  CompositeBackend,
  StoreBackend,
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
// Cross-thread persistent memory store
// --------------------------------------------------------
// This store persists across all threads/conversations
// Files in /memories/ are accessible from any thread
const memoryData: Record<string, any> = {};

const crossThreadStore = {
  async get(namespace: string[], key: string) {
    const fullKey = [...namespace, key].join("/");
    return memoryData[fullKey];
  },
  async put(namespace: string[], key: string, value: any) {
    const fullKey = [...namespace, key].join("/");
    memoryData[fullKey] = value;
  },
  async delete(namespace: string[], key: string) {
    const fullKey = [...namespace, key].join("/");
    delete memoryData[fullKey];
  },
  async search(namespacePrefix: string[]) {
    const prefix = namespacePrefix.join("/");
    return Object.keys(memoryData)
      .filter((k) => k.startsWith(prefix))
      .map((k) => [k.split("/").slice(-1)[0], memoryData[k]]);
  },
  async batch(ops: any[]) {
    const results: any[] = [];
    for (const op of ops) {
      if (op[0] === "put") {
        await this.put(op[1], op[2], op[3]);
        results.push({ ok: true });
      } else if (op[0] === "delete") {
        await this.delete(op[1], op[2]);
        results.push({ ok: true });
      }
    }
    return results;
  },
  async listNamespaces(prefix: string[]) {
    const prefixStr = prefix.join("/");
    const namespaces = new Set<string>();
    Object.keys(memoryData).forEach((k) => {
      if (k.startsWith(prefixStr)) {
        const parts = k.split("/");
        if (parts.length > prefix.length) {
          namespaces.add(parts[prefix.length]);
        }
      }
    });
    return Array.from(namespaces);
  },
  async start() {},
  async stop() {},
};

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
   *     /memories/knowledge/{{domain}}/community_note.md
   *     /memories/knowledge/{{domain}}/triples.jsonld
   */
  const enrichmentSubagent: SubAgent = {

  name: "knowledge_enrichment",

  description:

    "Inspect one DKG asset plus web sources and write a compact JSON-LD enrichment + community note.",

  systemPrompt: `${TOKEN_BUDGET_NOTE}

You are the ENRICHMENT subagent.

Goal:

- For a single task + optional UAL, combine DKG data and a few web sources

  into:

  1) A small JSON-LD enrichment graph, and

  2) A short community-note style Markdown summary.

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

Filesystem (MAX 2 FILES):

- /memories/knowledge/{{domain}}/triples.jsonld

- /memories/knowledge/{{domain}}/community_note.md

Where {{domain}} is:

- the explicit domain from the task, or

- "general" if not given.

Single-pass workflow:

1) Parse domain and UAL

   - If the user task or earlier messages clearly contain a DKG UAL, note it.

   - If no UAL is obvious, you may skip dkg_get and just rely on web search.

2) DKG inspection (if UAL is available)

   - Call dkg_get AT MOST ONCE for that UAL.

   - Treat the returned body as a JSON-LD array.

   - Identify the PRIMARY_SUBJECT_ID dynamically:

     • Prefer the node whose @type includes a schema:Organization-like type.

     • If several, prefer the one whose name best matches the main company

       mentioned in the task (e.g., "TSMC", "Taiwan Semiconductor Manufacturing Company").

     • If still ambiguous, choose the node with the most outgoing properties.

   - Do NOT paste raw JSON into messages; summarize in 5–8 bullets.

3) Web cross-check

   - Call internet_search AT MOST 3 times for focused queries

     (suppliers, customers, sites, risk, etc.).

   - If you hit 3 searches, STOP searching and summarize what you have.

   - For each search, extract only key facts + 1–3 high-quality URLs.

4) JSON-LD enrichment (triples.jsonld)

   - Build a SMALL JSON-LD array (5–30 nodes total) that:

     • REUSES PRIMARY_SUBJECT_ID for the main entity when a DKG asset exists.

     • Adds ONLY NEW facts as additional properties on that subject

       (avoid exact duplicates of existing triples).

     • Introduces new related entities (suppliers, customers, locations, risks)

       with stable @id values (e.g., "uuid:..." or URLs).

     • Connects them to PRIMARY_SUBJECT_ID via appropriate schema.org predicates

       (e.g., supplier, customer, location, geopoliticalRisk, supplyChainSignificance).

   - If there was no UAL / no dkg_get, you may still define a main subject

     @id yourself and build a small JSON-LD graph around it.

   - Write this JSON-LD array as pretty-printed JSON to:

     /memories/knowledge/{{domain}}/triples.jsonld

     using write_file exactly once (overwrite is fine).

5) Community note (community_note.md)

   - Write a concise Markdown note to:

     /memories/knowledge/{{domain}}/community_note.md

   Recommended structure:

   - Title line (e.g., "# TSMC supply-chain enrichment note")

   - "Key facts" – bullets summarizing the most important findings.

   - "Supply / risk / impact" – a few bullets or a short paragraph.

   - "Evidence (URLs)" – short bullet list of the best sources.

   - "Open questions" – at most 3 bullets.

Constraints:

- Use EACH of the two file paths at most once with write_file.

- Keep each file ≲ 400 tokens.

- Do NOT create any other files.

- Do NOT publish or update assets yourself; leave dkg_create to the main agent

  after human review.`,

  tools: [dkgGet as any, internetSearch as any],

};

  /**
   * SUBAGENT 2: VALIDATION
   *
   * Responsibilities
   * - Read community_note.md + triples.jsonld for the same domain.
   * - Use x402_trust_score a couple of times as a simulated signal.
   * - Append a compact validation section + final JSON block to community_note.md.
   */
  const validationSubagent: SubAgent = {
    name: "knowledge_validation",
    description:
      "Read community note + triples, call x402_trust_score sparingly, and append a compact validation summary.",
    systemPrompt: `${TOKEN_BUDGET_NOTE}

You are the VALIDATION subagent.

Goal:
- Turn the enrichment output into a small validation layer with a single
  global trust score.

Inputs:
- /memories/knowledge/{{domain}}/community_note.md
- /memories/knowledge/{{domain}}/triples.jsonld

(Use "general" for {{domain}} if no domain is given.)

Rules:
- NEVER call write_todos.
- Use tools:
  • read_file / write_file
  • x402_trust_score
- Keep all validation text very short and concrete.
- Use AT MOST 1 x402_trust_score call total.

Single validation pass:

1) Read files
   - Use read_file to load community_note.md and triples.jsonld.
   - Identify 3–7 key claims and any UAL(s) mentioned in the JSON block.

2) Call x402_trust_score
   - Choose AT MOST 1 UAL (the most important one).
   - Call x402_trust_score ONCE with a short "reason".
   - Remember: this is a SIMULATED trust signal; treat it as one input
     among others (web evidence, internal consistency, etc.).

3) Compute a global_trust_score in [0, 1]
   - Blend:
     • strength of evidence from community_note + triples,
     • simulated x402 scores,
     • any obvious gaps or concerns.
   - You do not need complex math; simple reasoning is enough.

4) APPEND to community_note.md (do NOT create new files):
   - A "Validation summary" section:
     • Bullet list of well-supported claims.
     • Bullet list of weak / partially supported points.
   - A short line like:
     "Global trust score: 0.82 (high confidence in core facts, moderate in economic figures)."

5) At the very end of community_note.md, append a JSON block:
   \`\`\`json
   { "global_trust_score": 0.0-1.0 }
   \`\`\`

6) Trust history (self-improvement):
   - Maintain a file at /memories/trust/history.jsonl.
   - For each validation run, append one JSON line like:
     {"ual": "<main_ual>", "global_trust_score": 0.87,
      "reason": "TSMC supply chain enrichment", "timestamp": "..."}
   - If the file already exists, read it, append the new line,
     and write it back.
   - Because /memories/** is persistent, this history will survive
     across threads and sessions.

Keep the whole validation addition ≲ 250 tokens.
Do not overwrite the earlier community note content; only append.`,
    tools: [x402TrustScore as any],
  };

  // -----------------------------
  // Memory backend with cross-thread persistence
  // -----------------------------
  // CompositeBackend routes /memories/ to persistent StoreBackend
  // while keeping per-thread state in StateBackend
  const backend = (config: { state: unknown; store?: any }) => {
    const store = config.store || crossThreadStore;
    const stateBackend = new StateBackend(config);
    const storeBackend = new StoreBackend({ ...config, store: store as any });
    
    return new CompositeBackend(stateBackend, {
      "/memories/": storeBackend,
    });
  };

  // -----------------------------
  // Main Knowledge Miner agent
  // -----------------------------

  const systemPrompt = `${TOKEN_BUDGET_NOTE}

You are the MAIN KNOWLEDGE MINER.

You have long-term memory mounted at the "/memories/" path.

There is a persistent instructions file at:
  /memories/instructions.md

At the start of each run:
- Try to read_file("/memories/instructions.md").
- If it does not exist, create it with 3–5 bullets describing
  stable user preferences and agent behaviors that worked well.
- Treat any bullets in that file as additional system-level
  instructions (never contradict them unless clearly obsolete).

When the user gives explicit feedback like
"please always do X", "I prefer Y", or "never do Z":
- Append a new bullet to /memories/instructions.md using
  write_file or edit_file so future runs can adapt.

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
  • /memories/knowledge/{{domain}}/community_note.md
  • /memories/knowledge/{{domain}}/triples.jsonld

Trust history (self-improvement):
- When computing a new global_trust_score, you MAY read
  /memories/trust/history.jsonl to see prior scores for the same UAL
  and mention any patterns (e.g., "this publisher has consistently
  high scores across past runs").

Final answer to the user:
- 2–4 short paragraphs summarizing:
  • key confirmed facts,
  • any partially validated items,
  • the final global_trust_score in [0,1] with a plain-language label
    (e.g., "high", "medium", "low" confidence).
- Mention the main report path so the UI can open it, e.g.
  "/memories/knowledge/supply-chain/community_note.md".`;

  const agent = createDeepAgent({
    systemPrompt,
    tools: [internetSearch, dkgGet, dkgCreate, x402TrustScore] as any,
    backend,
    // Cross-thread persistent store for /memories/ files
    store: crossThreadStore as any,
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
     * 40 is tight enough to prevent timeouts while allowing
     * the enrichment + validation workflow to complete.
     */
    recursionLimit: 40,
  };
}
