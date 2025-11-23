import { tool } from "@langchain/core/tools";
import { z } from "zod";

export type DkgPluginContext = {
  dkg?: any;
  blob?: any;
};

// ---------- Internet search tool (Tavily) ----------
export function makeInternetSearchTool(ctx: DkgPluginContext) {
  return tool(
    async ({ query }: { query: string }) => {
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

// ---------- DKG GET tool (real KA retrieval) ----------
export function makeDkgGetTool(ctx: DkgPluginContext) {
  return tool(
    async ({ ual }: { ual: string }) => {
      if (!ctx.dkg) return "DKG client not available in plugin context.";

      try {
        const result = await ctx.dkg.asset.get(ual, { includeMetadata: true });
        return JSON.stringify(result, null, 2);
      } catch (err: any) {
        return `dkg_get failed: ${err?.message ?? String(err)}`;
      }
    },
    {
      name: "dkg_get",
      description:
        "Retrieve a Knowledge Asset from the DKG by UAL (Unique Asset Locator). Returns full JSON including metadata.",
      schema: z.object({
        ual: z.string().describe("UAL of the Knowledge Asset to retrieve."),
      }),
    }
  );
}

// ---------- DKG CREATE tool (real KA publishing) ----------
export function makeDkgCreateTool(ctx: DkgPluginContext) {
  return tool(
    async ({ jsonld, privacy }: { jsonld: string; privacy?: "private" | "public" }) => {
      if (!ctx.dkg) return "DKG client not available in plugin context.";

      try {
        // Accept either raw JSON-LD string or ID of an uploaded file that plugin-dkg-essentials would use.
        const content =
          jsonld.startsWith("{") || jsonld.startsWith("[")
            ? jsonld
            : jsonld; // keep simple for now – treat as inline JSON-LD

        const parsed = JSON.parse(content);
        const wrapped = { [privacy || "private"]: parsed };

        const createAsset = await ctx.dkg.asset.create(wrapped, {
          epochsNum: 2,
          minimumNumberOfFinalizationConfirmations: 3,
          minimumNumberOfNodeReplications: 1,
        });

        const ual = createAsset?.UAL;
        return JSON.stringify(
          {
            kind: "dkg_create_result",
            ual,
            message: ual ? `Published to DKG. UAL: ${ual}` : "Published to DKG, UAL not returned.",
          },
          null,
          2
        );
      } catch (err: any) {
        return `dkg_create failed: ${err?.message ?? String(err)}`;
      }
    },
    {
      name: "dkg_create",
      description:
        "Publish a JSON-LD Knowledge Asset to the DKG. Returns a JSON object with the UAL and a human-readable message.",
      schema: z.object({
        jsonld: z
          .string()
          .describe("JSON-LD content string for the Knowledge Asset to publish."),
        privacy: z
          .enum(["private", "public"])
          .optional()
          .describe("Optional privacy level, default 'private'."),
      }),
    }
  );
}

// ---------- x402 trust score tool (structured, self-improving) ----------
let trustHistory: Array<{
  ual: string;
  score: number;
  reason: string;
  timestamp: number;
}> = [];

export function makeX402TrustScoreTool() {
  return tool(
    async ({
      ual,
      reason,
      signal,
    }: {
      ual: string;
      reason: string;
      signal?: "positive" | "negative" | "neutral";
    }) => {
      // Very simple heuristic; the Validation subagent will evolve the *instructions*
      // in /memories/trust/instructions.txt based on feedback.
      const base =
        signal === "positive" ? 0.9 : signal === "negative" ? 0.4 : 0.7;
      const noise = Math.random() * 0.05 - 0.025;
      const score = Math.min(1, Math.max(0, base + noise));

      const record = { ual, score, reason, timestamp: Date.now() };
      trustHistory.push(record);

      return {
        kind: "x402_trust_signal",
        ual,
        reason,
        score,
        timestamp: record.timestamp,
        historySize: trustHistory.length,
        comment:
          "Simulated x402 trust score. The Validation subagent maintains and refines trust heuristics in /memories/trust/instructions.txt over time.",
      };
    },
    {
      name: "x402_trust_score",
      description:
        "Simulate an x402 trust / economic signal for a given KA UAL. The Validation subagent updates /memories/trust/instructions.txt over time to refine how this score should be interpreted.",
      schema: z.object({
        ual: z.string().describe("UAL of the Knowledge Asset being evaluated."),
        reason: z.string().describe("Why this asset is being scored."),
        signal: z
          .enum(["positive", "negative", "neutral"])
          .optional()
          .describe("Overall qualitative signal from validation (optional)."),
      }),
    }
  );
}