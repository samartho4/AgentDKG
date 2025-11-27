# DeepAgents Knowledge Miner - Testing Guide

## Quick Start

### 1. Prerequisites

Ensure services are running:
```bash
# Check server (should be on port 9200)
curl http://localhost:9200/health

# Check frontend (should be on port 8081)
curl http://localhost:8081
```

If not running:
```bash
# Terminal 1: Server
cd dkg-node/apps/agent
npm run dev:server

# Terminal 2: Frontend  
cd dkg-node/apps/agent
npm run dev:app
```

### 2. Access Application

Open browser: **http://localhost:8081/chat**

Login if needed (credentials from setup)

### 3. Run First Test

Type in chat:
```
Run a knowledge mining session to research TSMC supply chain
```

## What to Expect

### During Execution (30-60 seconds)

**Tool Call Card Appears:**
```
┌─────────────────────────────────────────┐
│ knowledge_miner_run - dkg-agent         │
│ (MCP Server)                            │
│                                         │
│ Status: loading 🔄                      │
│ Input: { task: "Research TSMC..." }    │
└─────────────────────────────────────────┘
```

**DeepAgentsPanel Shows Live Progress:**
```
┌─ Knowledge Mining Workspace ────────────┐
│ thread_id: abc123                       │
│ Status: 🔄 Searching web...             │
│                                         │
│ ⚡ Live Progress                        │
│   🚀 Starting knowledge mining...       │
│   🌐 Searching web for: "TSMC..."      │
│   🔗 Discovering knowledge...           │
│   💾 Saving to memory...                │
└─────────────────────────────────────────┘
```

### After Completion

**1. Execution Log (Expandable)**
```
📊 Execution Log (8 steps)
  🚀 Starting knowledge mining session...
  Step 1: 🌐 Searching web for: "TSMC supply chain"
  Step 2: 🔗 Discovering knowledge: "supply chain risks"
  Step 3: 💾 Saving to: /memories/knowledge/supply-chain/research.md
  Step 4: 📋 Planning tasks
  ...
  ✅ Knowledge mining session complete!
```

**2. DeepAgentsPanel (Expanded)**
```
┌─ Knowledge Mining Workspace ────────────────────────┐
│ thread_id: abc123                                   │
│ Status: Completed                                   │
│                                                     │
│ 📋 To-dos (3/3 completed)                          │
│   ✅ Search web for TSMC supply chain              │
│   ✅ Search DKG for related KAs                    │
│   ✅ Analyze and save findings                     │
│                                                     │
│ 🔍 Knowledge Mining Workflow                       │
│   🌐 Web Search: "TSMC supply chain"               │
│      [Click to expand - shows Tavily results]      │
│   🔗 DKG Discovery: "supply chain risks"           │
│      [Click to expand - shows DKG results]         │
│   💾 Memory Storage: /memories/knowledge/...       │
│      [Click to expand - shows file content]        │
│                                                     │
│ 🧠 Memories & Files                                │
│   📄 /memories/knowledge/supply-chain/research.md  │
│      [Click to expand - shows full content]        │
│                                                     │
│ 🤖 Subagents Delegated                             │
│   • Analyze geopolitical risks                     │
└─────────────────────────────────────────────────────┘
```

**3. Agent Response**
```
I've completed a comprehensive research session on TSMC supply chain.
Here are the key findings:

[Summary of research]

A comprehensive analysis has been saved to /memories/...
```

## Test Cases

### Test 1: Basic Web Search

**Query:**
```
Research Tesla supply chain
```

**Expected:**
- ✅ Web search executed (Tavily API)
- ✅ Results visible in workflow section
- ✅ At least 1 file created
- ✅ Todos created and completed

**Verify:**
1. Expand "🌐 Web Search" in workflow
2. Should see URLs and snippets from web
3. Check execution log for "internet_search"

### Test 2: DKG Discovery

**Query:**
```
Search the DKG for supply chain knowledge and create a summary
```

**Expected:**
- ✅ DKG search executed
- ✅ UALs returned (if any exist)
- ✅ Summary created
- ✅ File saved to memory

**Verify:**
1. Expand "🔗 DKG Discovery" in workflow
2. Should see DKG query results
3. Check for UAL format: `did:dkg:...`

### Test 3: Knowledge Linking

**Query:**
```
Research semiconductor risks and link to existing DKG knowledge
```

**Expected:**
- ✅ Web search for research
- ✅ DKG search for existing KAs
- ✅ Link proposals generated
- ✅ Relationship types specified

**Verify:**
1. Check workflow for "🔗 Knowledge Linking"
2. Expand to see sourceUal and targetUals
3. Verify relation types (e.g., "relatedTo")

### Test 4: Memory Storage

**Query:**
```
Mine knowledge about renewable energy and save detailed findings
```

**Expected:**
- ✅ Multiple files created
- ✅ Files in `/memories/knowledge/` directory
- ✅ Content viewable inline
- ✅ Structured format (JSON or Markdown)

**Verify:**
1. Check "🧠 Memories & Files" section
2. Click on file to expand
3. Verify content is readable and structured

### Test 5: Subagent Delegation

**Query:**
```
Research AI chip manufacturing with detailed geopolitical and technical analysis
```

**Expected:**
- ✅ Complex task delegated to subagents
- ✅ Multiple subtasks visible
- ✅ Subagent names shown
- ✅ Results integrated

**Verify:**
1. Check "🤖 Subagents Delegated" section
2. Should list delegated tasks
3. Check workflow for "task" tool usage

### Test 6: Real-Time Progress

**Query:**
```
Comprehensive research on quantum computing supply chain
```

**Expected:**
- ✅ Live progress updates during execution
- ✅ Status changes in real-time
- ✅ Todo count updates
- ✅ File count updates

**Verify:**
1. Watch "⚡ Live Progress" section during execution
2. Should see messages updating every few seconds
3. Status should change from one tool to another

## Interactive Testing

### Expand Tool Outputs

**Steps:**
1. Find "🔍 Knowledge Mining Workflow" section
2. Click on any tool execution (e.g., "🌐 Web Search")
3. Panel expands to show:
   - Input parameters
   - Full output (up to 500 chars preview)
   - Timestamp

**What to Look For:**
- Web search: URLs, titles, snippets
- DKG search: UALs, metadata
- File writes: File paths, content preview

### View File Contents

**Steps:**
1. Find "🧠 Memories & Files" section
2. Click on any file path
3. Content viewer expands

**What to Look For:**
- Markdown formatting preserved
- JSON properly formatted
- Content is readable and relevant

### Check Todo Progress

**Steps:**
1. Find "📋 To-dos" section
2. Look at status indicators:
   - ⏳ = Pending
   - 🔄 = In Progress
   - ✅ = Completed

**What to Look For:**
- All todos should eventually be ✅
- Todo descriptions match the task
- Count shows X/Y completed

## Debugging

### Issue: No Real-Time Updates

**Symptoms:**
- Panel appears but no live progress
- Status stuck on "Processing..."
- No updates during execution

**Debug Steps:**
1. Open browser DevTools (F12)
2. Go to Network tab
3. Filter for "progress"
4. Should see EventSource connection
5. Check for messages streaming in

**Fix:**
```bash
# Rebuild plugin
cd packages/plugin-deepagents-knowledge-miner
npm run build

# Restart server
cd ../../apps/agent
# Stop dev:server and restart
```

### Issue: Web Search Not Working

**Symptoms:**
- No "🌐 Web Search" in workflow
- Agent skips internet search
- Empty search results

**Debug Steps:**
1. Check API key:
   ```bash
   grep TAVILY apps/agent/.env
   ```

2. Check execution log for "internet_search"

3. Verify Tavily API is working:
   ```bash
   curl -X POST https://api.tavily.com/search \
     -H "Content-Type: application/json" \
     -d '{"api_key":"YOUR_KEY","query":"test"}'
   ```

**Fix:**
- Set `TAVILY_API_KEY` in `.env`
- Restart server

### Issue: Panel Not Appearing

**Symptoms:**
- Tool completes but no panel
- No "Knowledge Mining Workspace" section

**Debug Steps:**
1. Check browser console for errors
2. Verify response contains `deepagents-meta`:
   ```javascript
   // In console
   console.log(messages[messages.length - 1].content);
   ```

3. Check for React rendering errors

**Fix:**
- Clear browser cache
- Refresh page
- Check server logs for errors

### Issue: SSE Connection Failed

**Symptoms:**
- Console error: "EventSource failed"
- No live updates
- Connection closes immediately

**Debug Steps:**
1. Test endpoint directly:
   ```bash
   curl "http://localhost:9200/progress?sessionId=test-123"
   ```

2. Check server logs for errors

3. Verify CORS headers

**Fix:**
- Ensure server is running
- Check firewall/proxy settings
- Verify endpoint is accessible

## Performance Testing

### Load Test

**Query:**
```
Research 5 different topics: AI, blockchain, quantum computing, renewable energy, and space exploration
```

**Expected:**
- ✅ Handles multiple searches
- ✅ Progress updates remain smooth
- ✅ All results captured
- ✅ No memory leaks

**Monitor:**
- Browser memory usage
- Server CPU/memory
- SSE connection stability

### Timeout Test

**Query:**
```
Extremely detailed research on global semiconductor supply chain with comprehensive analysis of every major manufacturer
```

**Expected:**
- ✅ Completes within 5 minutes (timeout)
- ✅ Graceful handling if timeout occurs
- ✅ Partial results saved

**Monitor:**
- Execution time
- Timeout handling
- Error messages

## Validation Checklist

After each test, verify:

- [ ] Tool call completed successfully
- [ ] DeepAgentsPanel appeared
- [ ] Live progress showed during execution
- [ ] Execution log is complete
- [ ] Todos were created and completed
- [ ] At least one tool was executed
- [ ] Files were created (if applicable)
- [ ] Tool outputs are expandable
- [ ] File contents are viewable
- [ ] No console errors
- [ ] SSE connection worked
- [ ] Final summary is coherent

## Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| No live updates | SSE not connected | Check sessionId, restart server |
| Empty workflow | Agent didn't use tools | Check system prompt, try different query |
| No web results | Tavily API key missing | Set TAVILY_API_KEY in .env |
| Panel not showing | Meta block missing | Check plugin output format |
| Slow execution | Complex query | Normal for 30-60s, increase timeout if needed |
| Connection timeout | Network issues | Check server connectivity |

## Success Criteria

A successful test should show:

1. ✅ **Real-time visibility**: Live progress during execution
2. ✅ **Complete transparency**: All tool calls visible
3. ✅ **Interactive exploration**: Expandable outputs and files
4. ✅ **Task tracking**: Todos with status
5. ✅ **Knowledge capture**: Files saved to memory
6. ✅ **Workflow clarity**: Clear step-by-step execution
7. ✅ **Error handling**: Graceful failures with messages

## Advanced Testing

### Custom Domain

**Query:**
```
Research healthcare supply chain in the healthcare domain
```

**Verify:**
- Domain tag passed to tools
- Results filtered by domain
- Files organized by domain

### Error Handling

**Query:**
```
Research [intentionally invalid query to trigger error]
```

**Verify:**
- Error message shown
- SSE publishes error event
- Panel shows error state
- No crashes

### Concurrent Sessions

**Steps:**
1. Open two browser tabs
2. Start mining in both
3. Verify separate sessions

**Verify:**
- Different sessionIds
- Independent progress
- No cross-contamination

## Reporting Issues

When reporting issues, include:

1. **Query used**: Exact text entered
2. **Expected behavior**: What should happen
3. **Actual behavior**: What actually happened
4. **Console logs**: Browser console errors
5. **Server logs**: Server output
6. **Screenshots**: UI state
7. **Environment**: Browser, OS, Node version

## Next Steps

After successful testing:

1. ✅ Try different query types
2. ✅ Test edge cases
3. ✅ Verify all features work
4. ✅ Check performance
5. ✅ Document any issues
6. ✅ Provide feedback

## Summary

The DeepAgents Knowledge Miner should provide:
- Real-time progress visibility
- Complete execution transparency
- Interactive result exploration
- Reliable tool execution
- Graceful error handling

If all tests pass, the implementation is working correctly!
