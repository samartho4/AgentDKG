# DeepAgents Knowledge Miner - Complete Implementation Guide

## Overview

This document describes the complete implementation of the DeepAgents Knowledge Miner plugin for the DKG Agent, including real-time progress streaming via Server-Sent Events (SSE).

## Architecture

### Components

1. **Plugin**: `@dkg/plugin-deepagents-knowledge-miner`
   - Location: `packages/plugin-deepagents-knowledge-miner/`
   - Implements autonomous knowledge mining using DeepAgents framework
   - Publishes real-time progress via SSE

2. **SSE Endpoint**: `/progress` API route
   - Location: `apps/agent/src/app/progress+api.ts`
   - Streams real-time progress updates to the UI
   - Uses Server-Sent Events for one-way server-to-client communication

3. **Progress Publisher**: Shared module
   - Location: `apps/agent/src/shared/progress.ts`
   - In-memory channel for progress updates
   - Shared between plugin and SSE endpoint

4. **UI Panel**: `DeepAgentsPanel` component
   - Location: `apps/agent/src/components/Chat/DeepAgentsPanel.tsx`
   - Displays real-time progress and final results
   - Subscribes to SSE updates

## Features

### 1. Autonomous Knowledge Mining

The agent performs multi-step research workflows:

- **🌐 Web Search**: Uses Tavily API to search the internet
- **🔗 DKG Discovery**: Searches existing Knowledge Assets in the DKG
- **🔗 Knowledge Linking**: Links new KAs to existing ones via UALs
- **💾 Memory Storage**: Saves research findings to `/memories/` files
- **📋 Planning**: Creates and manages todos for task tracking
- **🤖 Subagent Delegation**: Delegates complex subtasks to specialized agents

### 2. Real-Time Progress Streaming

**How it works:**

```
User Request → LLM → knowledge_miner_run tool
                          ↓
                    Agent starts execution
                          ↓
                    Publishes progress → SSE Channel
                          ↓
                    UI subscribes → EventSource
                          ↓
                    Real-time updates in panel
```

**Progress Updates Include:**
- Tool execution start/complete
- Current status messages
- Todo updates
- File creation notifications
- Error messages

### 3. Interactive UI Panel

**Live Progress Section** (during execution):
- Real-time status updates
- Last 5 progress messages
- Visual indicators (🔄 for active, ✅ for complete)

**Post-Execution View**:
- Complete execution log (expandable)
- Todos with status indicators
- Knowledge mining workflow with expandable tool outputs
- Memories & files with content viewer
- Subagent delegation tracking

## Implementation Details

### Plugin Configuration

**Tools Provided:**
1. `internet_search` - Web search via Tavily API
2. `dkg_search_knowledge_assets` - Search DKG for existing KAs
3. `dkg_link_knowledge_assets` - Propose linking KAs
4. `x402_simulate_payment` - Simulate token payments

**DeepAgents Built-in Tools:**
- `write_todos` - Task planning
- `write_file` - File system access
- `task` - Subagent delegation

### SSE Implementation

**Endpoint**: `GET /progress?sessionId={id}`

**Event Types:**
```typescript
{
  type: 'status' | 'tool_start' | 'tool_complete' | 'tool_error' | 'complete' | 'error',
  message?: string,
  tool?: string,
  input?: any,
  output?: any,
  progress?: number,
  timestamp: number
}
```

**Connection Flow:**
1. Tool call includes `sessionId` parameter
2. Plugin publishes progress to shared channel
3. UI subscribes to SSE endpoint with sessionId
4. Updates stream in real-time
5. Connection closes on completion/error

### UI Integration

**DeepAgentsPanel subscribes to SSE:**
```typescript
useEffect(() => {
  const eventSource = new EventSource(`/progress?sessionId=${sessionId}`);
  
  eventSource.onmessage = (event) => {
    const update = JSON.parse(event.data);
    setLiveProgress(prev => [...prev, update]);
    setCurrentStatus(update.message);
  };
  
  return () => eventSource.close();
}, [sessionId]);
```

## Configuration

### Environment Variables

Required in `apps/agent/.env`:

```bash
# Tavily API for web search
TAVILY_API_KEY=tvly-xxx

# LLM Configuration (DeepAgents auto-detects)
ANTHROPIC_API_KEY=sk-ant-xxx  # Recommended: Claude for best tool calling
# OR
OPENAI_API_KEY=sk-xxx
# OR
GOOGLE_API_KEY=xxx
```

### LLM Selection

DeepAgents automatically selects the LLM based on available API keys:
1. Checks for `ANTHROPIC_API_KEY` → Uses Claude (recommended)
2. Checks for `OPENAI_API_KEY` → Uses GPT-4
3. Checks for `GOOGLE_API_KEY` → Uses Gemini

**Recommendation**: Use Claude (Anthropic) for best tool calling reliability.

## Usage

### Basic Usage

In the chat interface:
```
Run a knowledge mining session to research TSMC supply chain risks
```

### What Happens

1. **LLM calls tool**: `knowledge_miner_run` with task description
2. **Agent starts**: Creates session and begins execution
3. **Real-time updates**: UI shows live progress as agent works
4. **Tool executions**: Agent searches web, DKG, creates files, etc.
5. **Completion**: Final results displayed with full execution history

### Expected Output

**During Execution** (30-60 seconds):
- Live progress panel shows current activity
- Status updates in real-time
- Todo count and file count update

**After Completion**:
- Full execution log (expandable)
- All todos with completion status
- Complete workflow with tool outputs
- All created files with content
- Agent's final summary

## Testing

### 1. Start Services

```bash
# Terminal 1: Server
cd dkg-node/apps/agent
npm run dev:server

# Terminal 2: Frontend
cd dkg-node/apps/agent
npm run dev:app
```

### 2. Access Application

Open: http://localhost:8081/chat

### 3. Test Queries

**Basic Research:**
```
Research TSMC supply chain and save findings
```

**With Domain:**
```
Mine knowledge about renewable energy trends in the supply-chain domain
```

**Complex Analysis:**
```
Investigate semiconductor manufacturing risks, search the web and DKG, then create a comprehensive analysis
```

### 4. Verify Features

✅ **Real-time progress**: See status updates during execution
✅ **Web search results**: Expand tool outputs to see Tavily results
✅ **File creation**: View created memory files inline
✅ **Todo tracking**: See tasks created and completed
✅ **Subagent usage**: Check if complex tasks were delegated

## Troubleshooting

### No Real-Time Updates

**Check:**
1. Browser console for SSE connection errors
2. Server logs for progress publishing
3. SessionId is being passed to tool

**Fix:**
```bash
# Rebuild plugin
cd packages/plugin-deepagents-knowledge-miner
npm run build

# Restart server
cd ../../apps/agent
# Stop and restart dev:server
```

### Web Search Not Working

**Check:**
1. `TAVILY_API_KEY` is set in `.env`
2. Agent actually called `internet_search` (check execution log)
3. Expand tool output to see results

**Verify:**
```bash
grep TAVILY apps/agent/.env
```

### Panel Not Appearing

**Check:**
1. Tool completed successfully
2. `deepagents-meta` block in response
3. Browser console for React errors

**Debug:**
```javascript
// In browser console
console.log('Messages:', messages);
console.log('Meta:', extractDeepAgentsMeta(messages));
```

### SSE Connection Failed

**Check:**
1. `/progress` endpoint is accessible
2. CORS headers are correct
3. SessionId matches between tool and UI

**Test endpoint:**
```bash
curl "http://localhost:9200/progress?sessionId=test-123"
```

## File Structure

```
dkg-node/
├── packages/plugin-deepagents-knowledge-miner/
│   ├── src/
│   │   ├── index.ts          # Plugin registration & SSE publishing
│   │   └── agent.ts          # Agent configuration & tools
│   └── package.json
│
├── apps/agent/src/
│   ├── app/
│   │   ├── progress+api.ts   # SSE endpoint
│   │   └── (protected)/
│   │       └── chat.tsx      # Chat page with sessionId injection
│   ├── components/Chat/
│   │   └── DeepAgentsPanel.tsx  # UI panel with SSE subscription
│   └── shared/
│       └── progress.ts       # Shared progress channel
│
└── docs/
    ├── DEEPAGENTS_COMPLETE_GUIDE.md  # This file
    └── DEEPAGENTS_TESTING.md         # Testing guide
```

## API Reference

### MCP Tool: knowledge_miner_run

**Input:**
```typescript
{
  task: string;        // Task description
  domain?: string;     // Optional domain tag
  sessionId?: string;  // Auto-injected by UI for SSE
}
```

**Output:**
```typescript
{
  content: [{
    type: "text",
    text: string  // Includes execution log and deepagents-meta block
  }]
}
```

### SSE Endpoint: GET /progress

**Query Parameters:**
- `sessionId` (required): Session identifier

**Response Format:**
```
data: {"type":"status","message":"Starting...","timestamp":1234567890}\n\n
data: {"type":"tool_start","tool":"internet_search","message":"Searching..."}\n\n
data: {"type":"tool_complete","tool":"internet_search","output":"..."}\n\n
data: {"type":"complete","message":"Done!","progress":100}\n\n
```

## Performance Considerations

### Memory Usage

- Progress channels stored in-memory
- Automatically cleaned up on completion
- For production: Consider Redis for multi-instance support

### Timeouts

- Tool execution: 300 seconds (5 minutes)
- SSE connection: Closes on completion
- Cleanup delay: 1 second after completion

### Scalability

Current implementation:
- ✅ Single server instance
- ✅ In-memory channels
- ❌ Not suitable for multi-instance deployment

For production:
- Use Redis for progress channels
- Implement session affinity or shared state
- Add connection pooling

## Future Enhancements

### Planned Features

1. **Human-in-the-Loop**: Approve/reject actions during execution
2. **Memory Persistence**: Save agent memory across sessions
3. **Knowledge Graph Visualization**: Show linked KAs graphically
4. **Export Results**: Download research as PDF/Markdown
5. **Session History**: View past mining sessions
6. **Custom Tools**: Allow users to add domain-specific tools

### Technical Improvements

1. **WebSocket Support**: Bidirectional communication
2. **Progress Persistence**: Store in database
3. **Retry Logic**: Handle transient failures
4. **Rate Limiting**: Prevent API abuse
5. **Caching**: Cache web search results

## Contributing

When modifying the DeepAgents implementation:

1. **Update plugin**: Rebuild after changes
   ```bash
   cd packages/plugin-deepagents-knowledge-miner
   npm run build
   ```

2. **Restart server**: Pick up new plugin code
   ```bash
   cd apps/agent
   # Restart dev:server process
   ```

3. **Test SSE**: Verify real-time updates work
4. **Update docs**: Keep this guide current

## Support

For issues or questions:
1. Check troubleshooting section above
2. Review browser console and server logs
3. Verify environment variables are set
4. Test with simple queries first

## Summary

The DeepAgents Knowledge Miner provides:
- ✅ Autonomous multi-step research
- ✅ Real-time progress streaming via SSE
- ✅ Interactive UI with expandable details
- ✅ Complete execution transparency
- ✅ Web search, DKG discovery, and knowledge linking
- ✅ Memory storage and task planning
- ✅ Subagent delegation for complex tasks

This creates a powerful, transparent knowledge mining experience with full visibility into the agent's reasoning and actions.
