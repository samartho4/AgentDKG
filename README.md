<div align="center">

# AgentDKG: Neuro-Symbolic Supply Chain Guardian

### Completing the Knowledge Mining Lifecycle on OriginTrail DKG

[![Challenge](https://img.shields.io/badge/Challenge-4%20Wild%20Card-purple?style=for-the-badge)](https://origintrail.io)
[![DKG Edge Node](https://img.shields.io/badge/DKG%20Edge%20Node-Required%20✓-green?style=for-the-badge)](https://docs.origintrail.io)
[![Architecture](https://img.shields.io/badge/Architecture-Agent%20│%20Knowledge%20│%20Trust-blue?style=for-the-badge)](https://x.com/sxmarthx/status/1994819143544312046)

**🏆 Built for "Scaling Trust in the Age of AI" Global Hackathon**

[Architecture](https://x.com/sxmarthx/status/1994819143544312046) • [Demo](https://www.youtube.com/watch?v=sfLTXr7AEdw) • [Installation](https://deepwiki.com/samartho4/AgentDKG/2-getting-started) • [Documentation](https://deepwiki.com/samartho4/AgentDKG/1-overview)

</div>

---

## 🎯 The Problem

Current AI agents suffer from **three critical limitations**:

> **1. Ephemeral Memory** — Agents forget everything between sessions  
> **2. No Provenance** — Reasoning cannot be verified or audited  
> **3. Incomplete Knowledge Mining** — Existing DKG only does 50% of the cycle

**OriginTrail's Knowledge Mining has 4 phases:**

```
Discovery → Publishing → Enrichment → Learning
    ✓           ✓            ✗            ✗
```

**AgentDKG completes this cycle.**

---

## 💡 Solution: Three-Layer Architecture

AgentDKG introduces a **DeepAgents plugin** that bridges neural reasoning with symbolic knowledge graphs, creating persistent, verifiable, self-improving AI agents.

```
┌─────────────────────────────────────────────────────────────────┐
│                        AGENT LAYER (Blue)                        │
├─────────────────────────────────────────────────────────────────┤
│  Expo UI → MCP Server → DeepAgents Plugin                       │
│  ├─ Main Orchestrator (reads /memories/instructions.md)         │
│  ├─ Enrichment Subagent (writes community_note + triples)       │
│  └─ Validation Subagent (computes trust, logs history)          │
│                                                                  │
│  Virtual Memory: /memories/                                      │
│  ├─ instructions.md (self-improving)                            │
│  ├─ knowledge/{domain}/community_note.md                        │
│  ├─ knowledge/{domain}/triples.jsonld                           │
│  └─ trust/history.jsonl                                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                     KNOWLEDGE LAYER (Green)                      │
├─────────────────────────────────────────────────────────────────┤
│  ctx.dkg Client → DKG Operations                                 │
│  ├─ dkg_get (retrieve Knowledge Assets by UAL)                  │
│  └─ dkg_create (publish JSON-LD to DKG)                         │
│                                                                  │
│  OriginTrail Network                                             │
│  └─ Knowledge Assets → NeuroWeb → Polkadot                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      TRUST LAYER (Orange)                        │
├─────────────────────────────────────────────────────────────────┤
│  x402_trust_score → Trust Signals → Self Improving              │
│  └─ Multi-factor scoring: diversity, recency, corroboration     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🏗️ Architecture Deep Dive

### Layer 1: Agent Layer (Blue)

The Agent Layer implements a **DeepAgents plugin** with MCP (Model Context Protocol) integration, featuring specialized subagents with context isolation.

| Component | Description | Key Innovation |
|-----------|-------------|----------------|
| **MCP Server** | Exposes tools to LLM workflows via Model Context Protocol | Standard DKG Node capability |
| **Main Orchestrator** | Coordinates subagents, manages context window, handles tool calls | Reads `/memories/instructions.md` at startup for self-improvement |
| **Enrichment Subagent** | Discovers & cross-references facts | Writes `community_note.md` + `triples.jsonld` |
| **Validation Subagent** | Computes trust scores, validates knowledge | Reads enrichment outputs, logs to `history.jsonl` |
| **Virtual Memory** | Persistent file-based memory at `/memories/` | **KEY INNOVATION**: Cross-session learning |

#### Subagent Architecture

```typescript
// agent.ts - Subagent Definitions
const subagents = [
  {
    name: "knowledge_enrichment",
    tools: ["dkg_get", "internet_search", "write_file"],
    constraints: {
      dkg_get: { maxCalls: 1 },
      internet_search: { maxCalls: 3 }
    },
    outputs: [
      "/memories/knowledge/{domain}/community_note.md",
      "/memories/knowledge/{domain}/triples.jsonld"
    ]
  },
  {
    name: "knowledge_validation",
    tools: ["x402_trust_score", "read_file", "write_file"],
    constraints: {
      x402_trust_score: { maxCalls: 1 }
    },
    inputs: [
      "/memories/knowledge/{domain}/community_note.md",
      "/memories/knowledge/{domain}/triples.jsonld"
    ],
    outputs: [
      "/memories/trust/history.jsonld"
    ]
  }
];
```

**Why Subagents?**
- **Context Isolation**: Each subagent has a focused context window
- **Token Efficiency**: ≤200 tokens/message budget per subagent
- **Specialized Tools**: Enrichment gets search; Validation gets trust scoring
- **Auditable Workflow**: Clear handoff via persistent files

---

### Layer 2: Knowledge Layer (Green)

The Knowledge Layer leverages the **OriginTrail DKG** via the injected `ctx.dkg` client, providing verifiable, blockchain-anchored knowledge storage.

| Tool | Purpose | Parameters |
|------|---------|------------|
| `dkg_get` | Retrieve Knowledge Assets by UAL | `ual: string` |
| `dkg_create` | Publish JSON-LD to DKG | `content: JSON-LD, privacy: "private" \| "public"` |

#### DKG Integration Example

```typescript
// tools.ts - dkg_create implementation
export function makeDkgCreateTool(ctx: DkgContext) {
  return {
    name: "dkg_create",
    description: "Publish enriched knowledge as a Knowledge Asset on the DKG",
    schema: z.object({
      content: z.record(z.unknown()),
      privacy: z.enum(["private", "public"]).default("public")
    }),
    execute: async ({ content, privacy }) => {
      const result = await ctx.dkgClient.asset.create({
        public: content,
        private: {},
      }, {
        epochsNum: 2,
        maxNumberOfRetries: 3,
        frequency: 1,
        blockchain: {
          name: process.env.DKG_BLOCKCHAIN
        }
      });
      
      return {
        ual: result.UAL,
        status: "published",
        blockchain: process.env.DKG_BLOCKCHAIN
      };
    }
  };
}
```

#### JSON-LD Output Schema

```jsonld
{
  "@context": {
    "schema": "https://schema.org/",
    "dkg": "https://origintrail.io/ontology/",
    "trust": "https://x402.org/ontology/"
  },
  "@type": "dkg:CommunityNote",
  "schema:about": {
    "@type": "schema:Organization",
    "schema:name": "TSMC",
    "schema:identifier": "ual:otp:2043/0x..."
  },
  "dkg:enrichedBy": "AgentDKG/v1.0",
  "dkg:enrichmentDate": "2025-11-27T12:00:00Z",
  "trust:globalTrustScore": 0.87,
  "trust:trustSignals": [
    {
      "@type": "trust:X402Signal",
      "trust:source": "web_corroboration",
      "trust:confidence": 0.92
    }
  ],
  "schema:description": "TSMC governance analysis with cross-referenced sources..."
}
```

---

### Layer 3: Trust Layer (Orange)

The Trust Layer implements **x402-inspired trust scoring** with self-improving logic that persists across sessions.

| Component | Function | Output |
|-----------|----------|--------|
| `x402_trust_score` | Computes trust based on source diversity, recency, corroboration | `{ score: 0-1, signals: [...] }` |
| Trust Signals | Structured evidence for trust computation | Logged to `history.jsonl` |
| Self Improving | Analyzes historical scores to improve future assessments | Updates `instructions.md` |

#### Trust Scoring Algorithm

```typescript
// tools.ts - x402_trust_score implementation
export function makeX402TrustScoreTool() {
  return {
    name: "x402_trust_score",
    schema: z.object({
      claim: z.string(),
      sources: z.array(z.object({
        url: z.string(),
        snippet: z.string(),
        reliability: z.enum(["high", "medium", "low"])
      }))
    }),
    execute: async ({ claim, sources }) => {
      // Multi-factor trust computation
      const factors = {
        sourceDiversity: computeSourceDiversity(sources),
        temporalRecency: computeRecencyScore(sources),
        crossCorroboration: computeCorroborationScore(claim, sources),
        domainAuthority: computeDomainAuthority(sources)
      };
      
      const globalScore = weightedAverage(factors, {
        sourceDiversity: 0.25,
        temporalRecency: 0.20,
        crossCorroboration: 0.35,
        domainAuthority: 0.20
      });
      
      return {
        kind: "x402_trust_signal",
        global_trust_score: globalScore,
        factors,
        qualitative: globalScore > 0.7 ? "high" : globalScore > 0.4 ? "medium" : "low",
        timestamp: new Date().toISOString()
      };
    }
  };
}
```

---

## 🔄 Knowledge Mining Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                          USER QUERY                              │
│         "Analyze TSMC supply chain risks"                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MCP SERVER (Port 9200)                        │
│                Tool: knowledge_miner_run                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      MAIN ORCHESTRATOR                           │
│  1. Reads /memories/instructions.md (self-improvement)           │
│  2. Delegates to subagents                                       │
│  3. Manages token budget (≤200 tokens/message)                   │
└─────────────────────────────────────────────────────────────────┘
                    │                    │
        ┌───────────┘                    └───────────┐
        ▼                                            ▼
┌─────────────────────┐                  ┌─────────────────────┐
│ ENRICHMENT SUBAGENT │                  │ VALIDATION SUBAGENT │
├─────────────────────┤                  ├─────────────────────┤
│ • dkg_get (1x)      │                  │ • read_file         │
│ • internet_search   │                  │ • x402_trust_score  │
│   (≤3x via Tavily)  │                  │   (1x)              │
│ • write_file        │                  │ • write_file        │
└─────────────────────┘                  └─────────────────────┘
        │                                            │
        ▼                                            ▼
┌─────────────────────┐                  ┌─────────────────────┐
│   OUTPUT FILES      │──────────────────│    INPUT FILES      │
├─────────────────────┤                  ├─────────────────────┤
│ community_note.md   │ ═════════════════│ community_note.md   │
│ triples.jsonld      │ ═════════════════│ triples.jsonld      │
└─────────────────────┘                  └─────────────────────┘
                                                     │
                                                     ▼
                                         ┌─────────────────────┐
                                         │   TRUST OUTPUT      │
                                         ├─────────────────────┤
                                         │ history.jsonl       │
                                         │ (appended)          │
                                         └─────────────────────┘
                                                     │
                                                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                      MAIN ORCHESTRATOR                           │
│  • Reviews enrichment + validation outputs                       │
│  • Calls dkg_create to publish Knowledge Asset                   │
│  • Returns session summary + UAL                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 DKG (NeuroWeb → Polkadot)                        │
│  • Knowledge Asset published with 2 epochs                       │
│  • 3 finalization confirmations                                  │
│  • Blockchain-anchored provenance                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Key Innovations

### 1. Virtual Memory System (`/memories/`)

Unlike ephemeral chat agents, AgentDKG persists knowledge across sessions:

```
/memories/
├── instructions.md              # Self-improving agent instructions
├── knowledge/
│   ├── tsmc/
│   │   ├── community_note.md
│   │   └── triples.jsonld
│   └── intel/
│       ├── community_note.md
│       └── triples.jsonld
└── trust/
    └── history.jsonl            # Accumulated trust scores
```

**Impact**: The agent becomes smarter over time. Trust history informs future assessments.

### 2. Subagent Context Isolation

Each subagent operates with:
- **Isolated context window**: No cross-contamination
- **Specialized tool access**: Right tools for the right job
- **Token discipline**: Strict budget prevents context overflow

### 3. Complete Knowledge Mining Cycle

| Phase | Existing DKG | With AgentDKG |
|-------|--------------|---------------|
| **Discovery** | ✅ `dkg_get` | ✅ Enhanced with web search |
| **Publishing** | ✅ `dkg_create` | ✅ With trust metadata |
| **Enrichment** | ❌ Missing | ✅ Cross-referencing, annotation |
| **Learning** | ❌ Missing | ✅ Self-improving instructions |

### 4. Neuro-Symbolic Bridge

AgentDKG bridges:
- **Neural**: LLM reasoning, natural language understanding
- **Symbolic**: JSON-LD triples, DKG Knowledge Assets, verifiable provenance

---

## 📁 Project Structure

```
dkg-node/
├── apps/
│   └── agent/                   # Expo UI (existing)
│       └── src/
│           └── components/
│               ├── ChatPage.tsx              # Main chat interface
│               ├── DeepAgentsPanel.tsx       # Real-time agent workspace
│               ├── KnowledgeMinerPanel.tsx
│               └── ThreadHistoryPanel.tsx
│
└── packages/
    └── plugin-deepagents-knowledge-miner/    # OUR CONTRIBUTION
        ├── src/
        │   ├── agent.ts         # DeepAgents orchestrator
        │   ├── tools.ts         # MCP tools (dkg_get, dkg_create, x402)
        │   └── index.ts         # Plugin registration
        ├── tests/
        │   ├── unit/
        │   └── integration/
        └── package.json
```

---

## 🔧 Installation & Setup

### Prerequisites

- Node.js ≥ 18.0
- pnpm (recommended) or npm
- DKG Edge Node access
- Tavily API key (for web search)

### Quick Start

```bash
# Clone the fork
git clone https://github.com/YOUR_USERNAME/dkg-node.git
cd dkg-node

# Install dependencies
pnpm install

# Configure environment
cp .env.example .env

# Edit .env with your credentials:
# - DKG_BLOCKCHAIN=otp:20430 (testnet)
# - DKG_OTNODE_URL=https://v6-pegasus-node-02.origin-trail.network:8900
# - DKG_PUBLISH_WALLET=your_private_key
# - TAVILY_API_KEY=your_tavily_key
# - LLM_PROVIDER=anthropic
# - LLM_MODEL=claude-sonnet-4-20250514

# Build
pnpm build

# Run development server
pnpm dev
```

### Accessing the UI

- **Expo UI**: http://localhost:8081
- **MCP Server**: http://localhost:9200
- **SSE Progress**: http://localhost:9200/progress?sessionId={id}

---

## 🎮 Demo: Supply Chain Analysis

### Example Query

```
"Analyze TSMC's governance structure and supply chain vulnerabilities for Q4 2025. 
Cross-reference with recent geopolitical developments."
```

### Expected Agent Behavior

1. **Enrichment Subagent** activates:
   - Calls `dkg_get` for existing TSMC Knowledge Assets
   - Performs `internet_search` via Tavily (up to 3 queries)
   - Writes `community_note.md` with analysis
   - Generates `triples.jsonld` with structured facts

2. **Validation Subagent** activates:
   - Reads enrichment outputs
   - Calls `x402_trust_score` on key claims
   - Appends to `history.jsonl`
   - Updates community note with trust metadata

3. **Main Orchestrator** publishes:
   - Calls `dkg_create` with enriched Knowledge Asset
   - Returns UAL and session summary

### Sample Output

```json
{
  "session_id": "km_1732712400_tsmc",
  "domain": "tsmc",
  "status": "complete",
  "outputs": {
    "community_note": "/memories/knowledge/tsmc/community_note.md",
    "triples": "/memories/knowledge/tsmc/triples.jsonld",
    "ual": "ual:otp:20430/0x7a8f...3b2c"
  },
  "trust": {
    "global_score": 0.87,
    "qualitative": "high",
    "signals_count": 4
  },
  "token_usage": {
    "enrichment": 1842,
    "validation": 956,
    "total": 2798
  }
}
```

---

## 📚 References

- [OriginTrail DKG Documentation](https://docs.origintrail.io)
- [DKG Edge Node GitHub](https://github.com/OriginTrail/dkg-node)
- [Model Context Protocol (MCP)](https://modelcontextprotocol.io)
- [x402 Protocol](https://x402.org)
- [NeuroWeb on Polkadot](https://neuroweb.ai)

---

## 📄 License

MIT License - See [LICENSE](LICENSE) for details.

---

<div align="center">

**AgentDKG: From Ephemeral Chat to Collective Intelligence on the Decentralized Knowledge Graph**

*Built for the "Scaling Trust in the Age of AI" Global Hackathon*

</div>
