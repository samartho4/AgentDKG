# Design Document

## Overview

The DeepAgents Knowledge Miner transforms the DKG Node from a single-purpose supply chain tool into a general-purpose, domain-agnostic knowledge mining system. The architecture leverages LangChain's DeepAgents framework to create a hierarchical multi-agent system with three specialized subagents (discovery, enrichment, validation) that work together to mine, structure, and validate knowledge from the OriginTrail DKG and external sources.

The system uses a composite memory backend that separates ephemeral run state from persistent long-term memory, enabling the agents to learn and improve over time. Domain tags provide a flexible mechanism for organizing knowledge and memory across different verticals without hard-coding domain logic.

## Architecture

### High-Level Architecture

```mermaid
graph TB
    UI[Chat UI] -->|User message + tags| LLM[Top-level LLM]
    LLM -->|Calls tool| KM[knowledge-miner MCP Tool]
    KM -->|Invokes| DA[DeepAgent Harness]
    DA -->|Orchestrates| DISC[Discovery Subagent]
    DA -->|Orchestrates| ENR[Enrichment Subagent]
    DA -->|Orchestrates| VAL[Validation Subagent]
    
    DISC -->|Queries| DKG[DKG Tools]
    ENR -->|Queries| DKG
    VAL -->|Queries| DKG
    
    DISC -->|Reads/Writes| MEM[/memories/** Storage]
    ENR -->|Reads/Writes| MEM
    VAL -->|Reads/Writes| MEM
    
    DA -->|Returns JSON| KM
    KM -->|Returns result| LLM
    LLM -->|Displays| UI
```

### Plugin Architecture

The DeepAgents Knowledge Miner is implemented as a standalone plugin package that integrates with the existing DKG Node plugin system:

```
packages/
  plugin-deepagents-knowledge-miner/
    src/
      index.ts              # Main plugin definition
    package.json
    tsconfig.json
```

The plugin is registered in `apps/agent/src/server/index.ts` alongside other plugins like `dkgEssentialsPlugin` and `examplePlugin`.

### Memory Architecture

The system uses a **CompositeBackend** that routes storage based on path:

- **StateBackend**: Handles all paths except `/memories/**` - ephemeral, cleared after each run
- **StoreBackend**: Handles `/memories/**` paths - persistent across runs, backed by InMemoryStore (can be upgraded to Redis/PostgreSQL)

Memory organization by domain:

```
/memories/
  knowledge/
    supply_chain/
      discovery-notes.md      # Raw signals, patterns, sources
      schema-notes.md         # JSON-LD schemas, entity mappings
      validation-rules.md     # Heuristics for validation
    climate/
      discovery-notes.md
      schema-notes.md
      validation-rules.md
    general_risk/
      ...
```

Thread IDs are derived from sorted domain tags (e.g., `general_risk__supply_chain`), ensuring that runs with the same tags share memory context.

## Components and Interfaces

### 1. DeepAgents Knowledge Miner Plugin

**Location**: `packages/plugin-deepagents-knowledge-miner/src/index.ts`

**Responsibilities**:
- Initialize DeepAgents harness with subagents
- Configure CompositeBackend with StateBackend and StoreBackend
- Register MCP tool `knowledge-miner`
- Provide DKG tools to subagents
- Handle tool invocation and response formatting

**Key Dependencies**:
- `deepagents` - Multi-agent framework
- `@langchain/openai` - LLM provider
- `@langchain/langgraph-checkpoint` - Memory store
- `langchain` - Tool definitions
- `@dkg/plugins` - Plugin system integration

**Configuration**:
- `DEEPAGENTS_MODEL` environment variable (default: "gpt-4o-mini")
- Temperature: 0.2 (for consistency)
- Max iterations: 1-10 (configurable per call)

### 2. Subagents

#### Discovery Subagent

**Purpose**: Collect raw signals and candidate facts from DKG and external sources

**Tools Available**:
- `dkg_get_asset` - Fetch Knowledge Assets by UAL
- `dkg_sparql` - Execute SPARQL queries
- `tavily_search` - Web search via Tavily API for real-time information gathering
- Built-in DeepAgents tools:
  - `write_todos` - Plan and track discovery tasks
  - `write_file`, `read_file`, `edit_file` - Manage context and offload large search results
  - `task` - Spawn specialized subagents for complex subtasks

**System Prompt Key Points**:
- Use `write_todos` to plan discovery strategy before starting
- Understand user question and domain tags
- Mine relevant context from DKG via SPARQL and asset retrieval
- Use `tavily_search` for real-time web information when DKG data is insufficient
- Offload large search results to filesystem to manage context window
- Spawn subagents via `task` tool for complex research subtasks
- Read from `/memories/knowledge/<domainTag>/discovery-notes.md` before starting
- Append learned patterns, useful queries, and source heuristics to discovery notes
- Produce structured collection of facts, sources, hypotheses

**Output**: Raw facts, sources, hypotheses, and research context files

#### Enrichment Subagent

**Purpose**: Normalize, structure, and enrich raw signals into candidate Knowledge Assets with proper linking to existing DKG assets

**Tools Available**:
- `dkg_get_asset` - Fetch existing assets for linking
- `dkg_sparql` - Query for related entities and potential links
- Built-in DeepAgents tools (file I/O, todos, task spawning)

**System Prompt Key Points**:
- Use `write_todos` to plan enrichment and linking strategy
- Clean and normalize information from discovery
- **Link to existing high-quality Knowledge Assets**:
  - Query DKG via SPARQL to find related entities
  - Provide linking signals via UALs in the JSON-LD (e.g., `"relatedTo": { "@id": "did:dkg:..." }`)
  - Use semantic relationships (e.g., `schema:supplier`, `schema:partOf`, `dkg:derivedFrom`)
- Propose candidate Knowledge Assets as JSON-LD objects compatible with DKG
- Include provenance (sources), domain tags, and confidence scores
- Use `/memories/knowledge/<domainTag>/schema-notes.md` for schema patterns and linking heuristics
- Update schema notes with new entity mappings, validation rules, and successful linking patterns
- Spawn subagents for complex entity resolution or schema mapping tasks

**Output**: Candidate Knowledge Assets (JSON-LD format) with UAL links to existing DKG assets

#### Validation Subagent

**Purpose**: Validate candidate Knowledge Assets against DKG, learned heuristics, and trust/tokenomics signals

**Tools Available**:
- `dkg_get_asset` - Fetch assets for comparison and trust verification
- `dkg_sparql` - Query for duplicates and trust metrics
- `dkg_get_asset_metadata` - Retrieve ERC-721 metadata including stake amounts
- Built-in DeepAgents tools (file I/O, todos, task spawning)

**System Prompt Key Points**:
- Use `write_todos` to plan validation strategy
- Check internal consistency of candidates
- Detect duplicates or conflicts with existing DKG assets via SPARQL
- Verify required fields based on prior schemas
- **Leverage trust layer and tokenomics**:
  - Query asset metadata to check TRAC stake amounts (higher stake = higher trust signal)
  - Verify publisher reputation via ERC-721 token ownership and history
  - Use stake amounts as confidence multipliers (e.g., assets with >50K TRAC get +0.2 confidence)
  - Check for assets published by known trusted entities
- Assign confidence scores (0.0-1.0) based on:
  - Data quality and completeness
  - Source reliability
  - DKG stake/trust signals
  - Consistency with existing knowledge
- Use `/memories/knowledge/<domainTag>/validation-rules.md` for heuristics
- Update validation rules with new edge cases, trust thresholds, and stake-based heuristics
- Generate synthesized validation report with reasoning for each accept/reject decision

**Output**: Vetted candidate Knowledge Assets with confidence scores, trust signals, and detailed reasoning report

### 3. DKG Tools

Three tools expose DKG functionality to the DeepAgents harness:

#### dkg_get_asset

```typescript
{
  name: "dkg_get_asset",
  description: "Fetch a Knowledge Asset from the OriginTrail DKG by its UAL.",
  schema: z.object({ ual: z.string() }),
  func: async ({ ual }) => await dkg.asset.get(ual)
}
```

#### dkg_sparql

```typescript
{
  name: "dkg_sparql",
  description: "Run a SPARQL query against the OriginTrail DKG graph. Use for structured graph mining and finding related entities.",
  schema: z.object({ query: z.string() }),
  func: async ({ query }) => await dkg.graph.query(query)
}
```

#### dkg_get_asset_metadata

```typescript
{
  name: "dkg_get_asset_metadata",
  description: "Get ERC-721 metadata for a Knowledge Asset including stake amount, publisher, and trust signals.",
  schema: z.object({ ual: z.string() }),
  func: async ({ ual }) => {
    // Extract tokenId from UAL and query blockchain
    const metadata = await dkg.asset.getMetadata(ual);
    return {
      tokenId: metadata.tokenId,
      stakeAmount: metadata.stakeAmount, // TRAC tokens staked
      publisher: metadata.publisher,
      publishTime: metadata.publishTime,
      updateCount: metadata.updateCount
    };
  }
}
```

#### tavily_search (external)

```typescript
{
  name: "tavily_search",
  description: "Search the web for real-time information using Tavily API.",
  schema: z.object({ 
    query: z.string(),
    maxResults: z.number().optional()
  }),
  func: async ({ query, maxResults = 5 }) => {
    // Call Tavily API
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.TAVILY_API_KEY}`
      },
      body: JSON.stringify({ query, max_results: maxResults })
    });
    return await response.json();
  }
}
```

### 4. MCP Tool: knowledge-miner

**Registration**:
```typescript
mcp.registerTool("knowledge-miner", {
  title: "DeepAgents Knowledge Miner",
  description: "Multi-agent knowledge miner with long-term memory...",
  inputSchema: {
    query: z.string(),
    domainTags: z.array(z.string()).optional(),
    maxIterations: z.number().int().min(1).max(10).optional(),
  }
}, handler)
```

**Input Parameters**:
- `query` (string, required): User's knowledge mining task
- `domainTags` (string[], optional): Domain tags like ["supply_chain", "general_risk"]
- `maxIterations` (number, optional): Max agent iterations (1-10, default 4)

**Output Format**:
```json
{
  "summary": "Human-readable summary of findings",
  "candidateAssets": [
    {
      "@context": "...",
      "@type": "...",
      "properties": { ... },
      "linkedAssets": ["did:dkg:...", "did:dkg:..."],
      "trustSignals": {
        "confidence": 0.85,
        "linkedToHighStakeAssets": true,
        "averageLinkedStake": 75000
      }
    }
  ],
  "domainTags": ["supply_chain", "vendor_risk"],
  "memoryWrites": [
    "/memories/knowledge/supply_chain/discovery-notes.md",
    "/memories/knowledge/supply_chain/validation-rules.md"
  ],
  "todos": [
    "✓ Query DKG for existing supplier entities",
    "✓ Search web for recent vendor news",
    "⧗ Validate against trust thresholds"
  ],
  "spawnedSubagents": [
    {
      "name": "entity-resolver",
      "task": "Resolve supplier identifiers to DKG UALs",
      "status": "completed"
    }
  ],
  "filesystemFiles": [
    { "path": "/research/supplier-data.json", "size": 15360 },
    { "path": "/research/web-sources.md", "size": 8192 }
  ],
  "synthesizedReport": "Discovered 5 supplier entities with high-confidence links to existing DKG assets. 3 candidates have strong trust signals (>50K TRAC stake). Validation complete with 0.85 average confidence."
}
```

**Thread Management**:
- Thread ID = sorted domain tags joined with "__" (e.g., "general_risk__supply_chain")
- If no tags: thread ID = "global"
- Passed via `configurable.thread_id` to DeepAgents

### 5. Chat UI Enhancements

**Location**: `apps/agent/src/app/(protected)/chat.tsx`

**Changes**:

1. **State Management**:
```typescript
const [domainTags, setDomainTags] = useState<string[]>([]);
const [agentWorkspace, setAgentWorkspace] = useState<AgentWorkspace | null>(null);
const [showWorkspace, setShowWorkspace] = useState(false);

const toggleDomainTag = (tag: string) => {
  setDomainTags(prev => 
    prev.includes(tag) 
      ? prev.filter(t => t !== tag) 
      : [...prev, tag]
  );
};

interface AgentWorkspace {
  todos: string[];
  spawnedSubagents: Array<{ name: string; task: string; status: string }>;
  filesystemFiles: Array<{ path: string; size: number }>;
  memoryWrites: string[];
  synthesizedReport?: string;
}
```

2. **Tag Bar UI** (between Header and Chat.Messages):
```tsx
<View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
  <Text>Knowledge Miner tags</Text>
  <Button 
    color={domainTags.includes("supply_chain") ? "primary" : "card"}
    text="#supply_chain"
    onPress={() => toggleDomainTag("supply_chain")}
  />
  <Button 
    color={domainTags.includes("general_risk") ? "primary" : "card"}
    text="#general_risk"
    onPress={() => toggleDomainTag("general_risk")}
  />
  <Button
    color="secondary"
    text={showWorkspace ? "Hide Workspace" : "Show Workspace"}
    onPress={() => setShowWorkspace(!showWorkspace)}
    style={{ marginLeft: "auto" }}
  />
</View>
```

3. **Agent Workspace Visualization Panel**:
```tsx
{showWorkspace && agentWorkspace && (
  <View style={{ 
    backgroundColor: colors.card, 
    padding: 16, 
    borderRadius: 8,
    marginBottom: 16 
  }}>
    <Text style={{ fontSize: 18, fontWeight: "bold", marginBottom: 12 }}>
      Agent Workspace
    </Text>
    
    {/* To-Do List */}
    {agentWorkspace.todos.length > 0 && (
      <View style={{ marginBottom: 12 }}>
        <Text style={{ fontWeight: "600", marginBottom: 4 }}>📋 Planning:</Text>
        {agentWorkspace.todos.map((todo, i) => (
          <Text key={i} style={{ marginLeft: 8, color: colors.textSecondary }}>
            • {todo}
          </Text>
        ))}
      </View>
    )}
    
    {/* Spawned Subagents */}
    {agentWorkspace.spawnedSubagents.length > 0 && (
      <View style={{ marginBottom: 12 }}>
        <Text style={{ fontWeight: "600", marginBottom: 4 }}>🤖 Subagents:</Text>
        {agentWorkspace.spawnedSubagents.map((sub, i) => (
          <Text key={i} style={{ marginLeft: 8, color: colors.textSecondary }}>
            • {sub.name}: {sub.task} ({sub.status})
          </Text>
        ))}
      </View>
    )}
    
    {/* Filesystem Activity */}
    {agentWorkspace.filesystemFiles.length > 0 && (
      <View style={{ marginBottom: 12 }}>
        <Text style={{ fontWeight: "600", marginBottom: 4 }}>📁 Context Files:</Text>
        {agentWorkspace.filesystemFiles.map((file, i) => (
          <Text key={i} style={{ marginLeft: 8, color: colors.textSecondary }}>
            • {file.path} ({(file.size / 1024).toFixed(1)}KB)
          </Text>
        ))}
      </View>
    )}
    
    {/* Memory Writes */}
    {agentWorkspace.memoryWrites.length > 0 && (
      <View style={{ marginBottom: 12 }}>
        <Text style={{ fontWeight: "600", marginBottom: 4 }}>💾 Long-term Memory:</Text>
        {agentWorkspace.memoryWrites.map((path, i) => (
          <Text key={i} style={{ marginLeft: 8, color: colors.textSecondary }}>
            • {path}
          </Text>
        ))}
      </View>
    )}
    
    {/* Synthesized Report */}
    {agentWorkspace.synthesizedReport && (
      <View>
        <Text style={{ fontWeight: "600", marginBottom: 4 }}>📊 Synthesis:</Text>
        <Text style={{ marginLeft: 8, color: colors.textSecondary }}>
          {agentWorkspace.synthesizedReport}
        </Text>
      </View>
    )}
  </View>
)}
```

4. **Message Injection** (in `sendMessage` function):
```typescript
if (newMessage.role === "user" && domainTags.length) {
  const tagPrefix = domainTags.map(t => `#${t}`).join(" ");
  const contents = toContents(newMessage.content).map(c => {
    if (c.type !== "text") return c;
    return { ...c, text: `${tagPrefix}\n\n${c.text}` };
  });
  newMessage = { ...newMessage, content: contents };
}
```

5. **Workspace Updates from Tool Results**:
```typescript
// After tool call completes, parse workspace data
if (tc.name === "knowledge-miner" && tc.info?.output) {
  const output = JSON.parse(tc.info.output[0].text);
  setAgentWorkspace({
    todos: output.todos || [],
    spawnedSubagents: output.spawnedSubagents || [],
    filesystemFiles: output.filesystemFiles || [],
    memoryWrites: output.memoryWrites || [],
    synthesizedReport: output.synthesizedReport,
  });
  setShowWorkspace(true); // Auto-show workspace when data available
}
```

This provides full visibility into the DeepAgents workflow, showing planning, subagent delegation, context management, and memory learning in real-time.

## Data Models

### Knowledge Asset Candidate

```typescript
interface KnowledgeAssetCandidate {
  "@context": string | object;
  "@type": string;
  "@id"?: string;
  [key: string]: any; // Domain-specific properties
  
  // Metadata
  "provenance"?: {
    sources: string[];
    discoveredAt: string;
    confidence: number;
  };
  "domainTags"?: string[];
}
```

### Tool Response

```typescript
interface KnowledgeMinerResponse {
  summary: string;
  candidateAssets: KnowledgeAssetCandidate[];
  domainTags: string[];
  memoryWrites: string[];
}
```

### Memory Note Structure

Each memory file is markdown with structured sections:

**discovery-notes.md**:
```markdown
# Discovery Notes - <domainTag>

## Patterns
- Pattern 1: ...
- Pattern 2: ...

## Useful Sources
- Source 1: URL/UAL
- Source 2: URL/UAL

## Heuristics
- When looking for X, check Y
- Z entities are usually found via SPARQL query: ...
```

**schema-notes.md**:
```markdown
# Schema Notes - <domainTag>

## Common Schemas
### Entity Type: Supplier
```json
{
  "@type": "Organization",
  "name": "...",
  "identifier": "..."
}
```

## Entity Mappings
- External ID → DKG UAL mappings
- Field name normalizations
```

**validation-rules.md**:
```markdown
# Validation Rules - <domainTag>

## Required Fields
- All entities must have: @type, name, identifier

## Duplicate Detection
- Check SPARQL for existing entities with same identifier

## Edge Cases
- Case 1: If X is missing, infer from Y
- Case 2: Reject if confidence < 0.7
```

## Error Handling

### Plugin Initialization Errors

**Scenario**: DeepAgents dependencies not installed or environment misconfigured

**Handling**:
- Plugin should fail gracefully during server startup
- Log clear error message indicating missing dependencies
- Provide installation instructions in error message

### Tool Invocation Errors

**Scenario**: DKG tools fail (network issues, invalid UAL, SPARQL syntax error)

**Handling**:
- Catch errors in tool `func` implementations
- Return error message as tool result
- Allow subagents to handle errors and retry or adjust strategy

### Memory Storage Errors

**Scenario**: File write failures in /memories/** paths

**Handling**:
- Log warnings but don't fail the entire run
- Return partial results with note about memory write failures
- Include failed paths in `memoryWrites` array with error indicator

### JSON Parsing Errors

**Scenario**: DeepAgent returns non-JSON or malformed JSON

**Handling**:
```typescript
try {
  parsed = JSON.parse(text);
} catch {
  parsed = {
    summary: text,
    candidateAssets: [],
    domainTags,
    memoryWrites: [],
  };
}
```

### Timeout Handling

**Scenario**: Agent exceeds maxIterations or takes too long

**Handling**:
- DeepAgents framework handles iteration limits
- Return partial results if available
- Include timeout indicator in summary

## Testing Strategy

### Unit Tests

**Location**: `packages/plugin-deepagents-knowledge-miner/tests/`

**Test Cases**:
1. Plugin registration and initialization
2. DKG tool creation and invocation
3. Thread ID generation from domain tags
4. JSON response parsing and fallback handling
5. Memory path organization

**Mocking**:
- Mock `ctx.dkg.asset.get` and `ctx.dkg.graph.query`
- Mock DeepAgents `createDeepAgent` to return controlled responses
- Mock InMemoryStore for memory tests

### Integration Tests

**Location**: `dkg-node/apps/agent/tests/integration/`

**Test Cases**:
1. End-to-end knowledge mining flow with real DKG
2. Multi-run memory persistence (same thread ID)
3. Domain tag isolation (different thread IDs)
4. Subagent execution order and data flow
5. UI tag selection and message injection

**Setup**:
- Use test DKG instance or mock DKG server
- Seed with known Knowledge Assets
- Verify candidate assets match expected structure

### Manual Testing

**Scenarios**:
1. **Supply Chain Mining**: Select #supply_chain tag, ask about vendor risks
2. **Multi-Domain Mining**: Select #supply_chain + #general_risk, ask complex question
3. **No Tags**: Send query without tags, verify "global" thread
4. **Memory Learning**: Run same query twice, verify second run uses learned heuristics
5. **UI Interaction**: Toggle tags on/off, verify visual feedback

## Dependencies

### New Dependencies

Add to `packages/plugin-deepagents-knowledge-miner/package.json`:

```json
{
  "dependencies": {
    "deepagents": "^0.1.0",
    "langchain": "^0.3.0",
    "@langchain/openai": "^0.6.0",
    "@langchain/langgraph-checkpoint": "^0.1.0",
    "@langchain/core": "^0.3.0",
    "zod": "^3.22.0",
    "@dkg/plugins": "workspace:*"
  }
}
```

### Existing Dependencies

The plugin leverages existing dependencies already in the workspace:
- `@langchain/openai` (already in agent app)
- `@langchain/core` (already in agent app)
- `zod` (used throughout codebase)

## Human-in-the-Loop Integration

### Approval Workflow

For sensitive operations (publishing to DKG, high-stake decisions), implement human approval using LangGraph interrupts:

```typescript
const agent = createDeepAgent({
  // ... other config
  interruptOn: {
    // Require approval before publishing candidates to DKG
    "dkg_publish_asset": { allowedDecisions: ["approve", "edit", "reject"] },
    // Allow automatic execution for read-only operations
    "dkg_get_asset": false,
    "dkg_sparql": false,
    "tavily_search": false,
  },
  checkpointer: new MemorySaver(), // Required for interrupts
});
```

### UI Integration

When an interrupt occurs:

1. **Display Pending Action**:
```tsx
{pendingApproval && (
  <View style={{ backgroundColor: colors.warning, padding: 16 }}>
    <Text style={{ fontWeight: "bold" }}>⚠️ Approval Required</Text>
    <Text>Action: {pendingApproval.actionName}</Text>
    <Text>Arguments: {JSON.stringify(pendingApproval.args)}</Text>
    
    <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
      <Button text="Approve" onPress={() => handleDecision("approve")} />
      <Button text="Edit" onPress={() => setShowEditModal(true)} />
      <Button text="Reject" onPress={() => handleDecision("reject")} />
    </View>
  </View>
)}
```

2. **Resume Execution**:
```typescript
async function handleDecision(type: "approve" | "edit" | "reject", editedArgs?: any) {
  const decision = type === "edit" 
    ? { type: "edit", editedAction: { name: pendingApproval.actionName, args: editedArgs } }
    : { type };
    
  const result = await agent.invoke(
    new Command({ resume: { decisions: [decision] } }),
    { configurable: { thread_id: currentThreadId } }
  );
  
  setPendingApproval(null);
  // Continue processing result...
}
```

### Use Cases

- **Pre-publish Review**: Review candidate Knowledge Assets before publishing to DKG
- **High-stake Validation**: Approve assets with confidence < 0.7 or unusual patterns
- **Cost Control**: Approve operations that incur gas fees or API costs
- **Quality Assurance**: Human verification of critical supply chain data

## Configuration

### Environment Variables

Add to `dkg-node/apps/agent/.env`:

```bash
# DeepAgents Configuration
DEEPAGENTS_MODEL=gpt-4o-mini
# OpenAI API key (already configured)
OPENAI_API_KEY=sk-...
# Tavily API key for web search
TAVILY_API_KEY=tvly-...
```

### Server Registration

Update `apps/agent/src/server/index.ts`:

```typescript
import deepAgentsKnowledgeMinerPlugin from "@dkg/plugin-deepagents-knowledge-miner";

const app = createPluginServer({
  // ...
  plugins: [
    // ... existing plugins
    deepAgentsKnowledgeMinerPlugin,
    // ...
  ],
});
```

## Performance Considerations

### Memory Store Scaling

**Current**: InMemoryStore - suitable for development and single-instance deployments

**Future**: For production with multiple instances:
- Upgrade to Redis-backed store: `@langchain/langgraph-checkpoint-redis`
- Or PostgreSQL-backed store: `@langchain/langgraph-checkpoint-postgres`

**Migration Path**:
```typescript
// Replace InMemoryStore with Redis
import { RedisSaver } from "@langchain/langgraph-checkpoint-redis";
const store = new RedisSaver(redisClient);
```

### Agent Iteration Limits

- Default: 4 iterations
- Max: 10 iterations
- Prevents runaway agent loops
- Configurable per tool call

### DKG Query Optimization

- Subagents should use targeted SPARQL queries
- Avoid broad queries that return large result sets
- Cache frequently accessed Knowledge Assets in memory notes

### Concurrent Tool Calls

- DeepAgents handles tool parallelization internally
- Multiple DKG queries can run concurrently
- No additional configuration needed

## Security Considerations

### Authentication

- Plugin inherits existing OAuth2 authentication
- MCP tools require valid bearer token
- No additional auth layer needed

### Input Validation

- Zod schemas validate tool inputs
- SPARQL queries are passed to DKG as-is (DKG handles injection prevention)
- Domain tags are sanitized (alphanumeric + underscore only)

### Memory Isolation

- Thread IDs prevent cross-domain memory leakage
- Each domain tag combination gets isolated memory
- No user-specific data stored in /memories/** (all shared knowledge)

### Rate Limiting

- Consider adding rate limits to knowledge-miner tool
- Prevent abuse of expensive multi-agent operations
- Leverage existing API rate limiting infrastructure

## Migration Path

### Phase 1: Plugin Development
1. Create plugin package structure
2. Implement DeepAgents harness with subagents
3. Add DKG tools
4. Register MCP tool
5. Unit tests

### Phase 2: UI Integration
1. Add domain tag state management
2. Implement tag bar UI
3. Update sendMessage to inject tags
4. Manual testing

### Phase 3: Server Integration
1. Add plugin to server plugins array
2. Configure environment variables
3. Integration tests
4. Documentation

### Phase 4: Production Readiness
1. Upgrade memory store to Redis/PostgreSQL
2. Add monitoring and logging
3. Performance tuning
4. User documentation

## Future Enhancements

### 1. Auto-Publishing Pipeline

Add a "Publish to DKG" button in UI that:
- Takes validated candidate assets
- Calls existing DKG publisher tool
- Provides human review step before publishing

### 2. Additional Domain Tags

Expand tag bar with more domains:
- #climate
- #finance
- #clinical_trials
- #power_systems
- Custom tags (user-defined)

### 3. Memory Visualization

Dashboard showing:
- Memory growth over time per domain
- Most frequently used heuristics
- Confidence score trends

### 4. Subagent Customization

Allow users to:
- Configure subagent system prompts
- Add custom subagents for specific domains
- Adjust subagent tool access

### 5. Batch Knowledge Mining

Support mining multiple queries in parallel:
- Queue-based processing
- Progress tracking
- Bulk export of candidate assets
