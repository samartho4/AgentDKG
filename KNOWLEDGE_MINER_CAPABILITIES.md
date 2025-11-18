# Knowledge Miner Capabilities

## Overview
`knowledge_miner_run` is an autonomous deep agent that performs research, creates structured knowledge, and integrates with the DKG (Decentralized Knowledge Graph).

## What It Can Do

### 1. 🌐 Autonomous Web Research
- Searches the internet using Tavily API
- Gathers information from multiple sources
- Extracts relevant facts and insights
- **Tool**: `internet_search`

### 2. 📋 Intelligent Planning
- Creates structured todo lists for complex tasks
- Breaks down research into manageable steps
- Tracks completion status
- **Tool**: `write_todos`

### 3. 💾 Memory Management
- Saves research findings to persistent memory
- Organizes files by domain: `/memories/knowledge/<domain>/`
- Creates structured reports in markdown
- Maintains research notes and source lists
- **Tool**: `write_file`

### 4. 🔗 DKG Integration
- **Search Knowledge Assets**: Find existing KAs by query and tags
  - **Tool**: `dkg_search_kas`
  - Returns UALs (Universal Asset Locators) and metadata
  
- **Link Knowledge Assets**: Connect related KAs via semantic relationships
  - **Tool**: `dkg_link_kas`
  - Creates structured knowledge graphs

### 5. ✅ Validation & Trust Scoring
- Validates research findings
- Calculates x402 trust scores for knowledge assets
- Assesses credibility and confidence levels
- **Tool**: `x402_trust_score`

### 6. 📡 Real-time Progress Tracking
- Publishes progress updates via Server-Sent Events (SSE)
- Shows current tool execution
- Displays todo completion status
- Reports file creation

### 7. 🔄 Resumable Sessions
- Returns `thread_id` for each session
- Can resume interrupted research
- Maintains conversation context
- **Tool**: `knowledge_miner_resume`

## Available Tools

| Tool | Purpose | Input | Output |
|------|---------|-------|--------|
| `internet_search` | Web search via Tavily | query (string) | Search results JSON |
| `dkg_search_kas` | Find Knowledge Assets | query, tag (optional) | UALs + metadata |
| `dkg_link_kas` | Link KAs together | sourceUal, targetUals[], relation | Link instruction |
| `x402_trust_score` | Calculate trust score | ual, reason | Score (0-1) + comment |
| `write_file` | Save to memory | path, content | File saved confirmation |
| `write_todos` | Create task list | todos[] | Todo list created |

## Workflow Phases

### Phase 1: PLAN
- Analyzes the research task
- Creates a structured todo list
- Identifies required information

### Phase 2: DISCOVER
- Executes web searches
- Gathers raw data and sources
- Saves notes to `/memories/research/`

### Phase 3: ENRICH
- Searches for related Knowledge Assets in DKG
- Proposes semantic links between KAs
- Creates linking plans

### Phase 4: VALIDATE
- Reviews findings for accuracy
- Assigns confidence scores
- Calculates trust scores via x402

### Phase 5: PUBLISH
- Creates final structured report
- Saves to `/memories/knowledge/<domain>/`
- Returns summary to user

## Input Parameters

```javascript
{
  task: string,        // Required: Research task description
  domain?: string,     // Optional: Domain tag (e.g., 'supply-chain', 'tech')
  sessionId?: string   // Optional: For progress tracking via SSE
}
```

## Output Structure

```javascript
{
  content: [{
    type: "text",
    text: "Research summary with execution log"
  }],
  _meta: {
    debugPayload: {
      kind: "knowledge_miner_session",
      sessionId: "uuid",
      domain: "domain-name",
      task: "original task",
      todos: [...],
      workspacePaths: [...],
      subagentsUsed: [...],
      trustSignals: [...],
      mainReportPath: "/memories/knowledge/domain/report.md"
    }
  }
}
```

## Memory Structure

```
/memories/
├── research/
│   ├── sources.txt      # Raw source URLs
│   └── notes.txt        # Research notes
└── knowledge/
    └── <domain>/
        ├── report.md           # Final research report
        ├── linking_plan.md     # KA linking strategy
        └── validation_notes.md # Validation critique
```

## Token Optimization Tips

To minimize LLM token usage during testing:

1. **Use short, specific queries**: "What is X? One sentence."
2. **Limit scope**: "List 2 benefits of Y"
3. **Avoid open-ended questions**: Instead of "Tell me about AI", use "Define AI in 10 words"
4. **Set clear constraints**: "Summarize in 3 bullet points"
5. **Use domain tags**: Helps focus the research

## Example Usage

### Minimal Research (Low Token Usage)
```javascript
{
  task: "What is TypeScript? One sentence.",
  domain: "tech"
}
```

### Focused Research (Medium Token Usage)
```javascript
{
  task: "List 3 main benefits of microservices architecture",
  domain: "software-architecture"
}
```

### Comprehensive Research (High Token Usage)
```javascript
{
  task: "Research TSMC supply chain risks and create Knowledge Assets",
  domain: "supply-chain"
}
```

## Testing Strategy

The comprehensive test script (`test-knowledge-miner-comprehensive.js`) tests:

1. ✅ Basic web search functionality
2. ✅ Todo creation and planning
3. ✅ Memory file persistence
4. ✅ Progress tracking
5. ✅ Thread ID generation
6. ✅ Error handling

All tests use minimal queries to avoid excessive token consumption while validating full functionality.
