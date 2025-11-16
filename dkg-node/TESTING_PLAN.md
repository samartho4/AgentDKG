# DeepAgents Knowledge Miner - Testing Plan

## System Status

### ✅ Running Services
- **Server (MCP + API)**: http://localhost:9200/ (Process 17)
- **Web App**: http://localhost:8081/ (Process 14)
- **Login**: http://localhost:8081/login
- **Chat**: http://localhost:8081/chat

### ✅ Completed Implementation
1. Plugin package built and registered
2. MCP tools: `knowledge-miner.run` and `knowledge-miner.resume`
3. DeepAgentsPanel UI component
4. Chat page integration with human-in-the-loop controls
5. Server successfully running

---

## Test Plan

### Phase 1: Verify Tool Registration

#### Test 1.1: Check Server Logs
**Goal:** Confirm plugin loaded without errors

**Steps:**
1. Check server process output (Process 17)
2. Look for any error messages related to deepagents-knowledge-miner
3. Verify "Server running at http://localhost:9200/" message

**Expected Result:**
- No errors in server logs
- Server starts successfully

**Status:** ✅ PASSED - Server running without errors

#### Test 1.2: Access Chat Interface
**Goal:** Verify UI is accessible

**Steps:**
1. Open http://localhost:8081/login
2. Login with credentials:
   - Email: `admin@example.com`
   - Password: `admin123`
3. Navigate to http://localhost:8081/chat

**Expected Result:**
- Login successful
- Chat interface loads
- No console errors

**Status:** done

#### Test 1.3: Check Available Tools
**Goal:** Verify knowledge-miner tools are available to the agent

**Steps:**
1. In chat interface, look for tool selection UI
2. Check if `knowledge-miner.run` and `knowledge-miner.resume` appear in tools list
3. Verify tools can be enabled/disabled

**Expected Result:**
- Both tools visible in tools list
- Tools can be toggled on/off

**Status:** done

---

### Phase 2: Basic Tool Execution

#### Test 2.1: Simple Knowledge Mining Request
**Goal:** Test basic tool invocation

**Test Input:**
```
Run a knowledge mining session to research TSMC supply chain
```

**Expected Behavior:**
1. Agent recognizes the request
2. Agent calls `knowledge-miner.run` tool
3. Tool parameters:
   - `task`: "research TSMC supply chain"
   - `domain`: (optional, may be inferred)

**Expected Response:**
- Tool execution starts
- Thread ID is generated
- Agent begins research

**Possible Issues:**
- Missing API keys (ANTHROPIC_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY)
- DeepAgents dependencies not properly installed
- Tool not found error

**Status:** 🔧 NEEDS TESTING

#### Test 2.2: Verify DeepAgentsPanel Appears
**Goal:** Confirm UI panel renders with metadata

**Steps:**
1. After agent responds to Test 2.1
2. Look for DeepAgentsPanel above chat messages
3. Check panel content

**Expected Result:**
- Panel is visible
- Shows thread ID
- Shows status (e.g., "Completed" or "Awaiting human decisions")
- Shows workspace info (todos, memories)

**Status:** 🔧 NEEDS TESTING

---

### Phase 3: Human-in-the-Loop Testing

#### Test 3.1: Trigger Interrupt
**Goal:** Test interrupt mechanism

**Test Input:**
```
Run a knowledge mining session for ACME Corp supply chain ESG risks. 
Propose links to existing DKG Knowledge Assets and simulate x402 payments.
```

**Expected Behavior:**
1. Agent starts mining
2. Agent reaches a point requiring human approval (e.g., `dkg_link_knowledge_assets`)
3. Agent returns interrupt response
4. DeepAgentsPanel shows:
   - Status: "Awaiting human decisions (human-in-the-loop)"
   - List of pending actions
   - "Approve all & resume" button
   - "Reject all" button

**Status:** 🔧 NEEDS TESTING

#### Test 3.2: Approve Actions
**Goal:** Test approval flow

**Steps:**
1. From Test 3.1, click "Approve all & resume"
2. Verify `knowledge-miner.resume` is called
3. Check agent continues execution

**Expected Result:**
- Resume tool called with correct thread ID and decisions
- Agent continues and completes task
- Final results displayed

**Status:** 🔧 NEEDS TESTING

#### Test 3.3: Reject Actions
**Goal:** Test rejection flow

**Steps:**
1. Trigger another interrupt (similar to Test 3.1)
2. Click "Reject all"
3. Verify agent handles rejection

**Expected Result:**
- Resume tool called with "reject" decisions
- Agent acknowledges rejection
- Session ends or agent adjusts approach

**Status:** 🔧 NEEDS TESTING

---

### Phase 4: Advanced Features

#### Test 4.1: Web Search Integration
**Goal:** Verify internet_search tool works

**Prerequisites:**
- Set `TAVILY_API_KEY` environment variable (optional)

**Test Input:**
```
Research the latest news about TSMC semiconductor manufacturing
```

**Expected Behavior:**
- Agent uses `internet_search` tool
- Returns current information
- Cites sources

**Status:** 🔧 NEEDS TESTING

#### Test 4.2: DKG Search Integration
**Goal:** Verify dkg_search_knowledge_assets tool works

**Prerequisites:**
- DKG client properly configured
- DKG_OTNODE_URL set correctly

**Test Input:**
```
Search the DKG for existing Knowledge Assets about supply chain risks
```

**Expected Behavior:**
- Agent uses `dkg_search_knowledge_assets` tool
- Returns UALs of matching KAs
- Displays results

**Status:** 🔧 NEEDS TESTING

#### Test 4.3: Memory Persistence
**Goal:** Verify agent writes to /workspace/ and /memories/

**Test Input:**
```
Create a comprehensive report on TSMC and save it to your memory
```

**Expected Behavior:**
- Agent writes files to /workspace/ and /memories/
- DeepAgentsPanel shows memory files
- Files persist across sessions

**Status:** 🔧 NEEDS TESTING

#### Test 4.4: x402 Simulation
**Goal:** Verify x402_simulate_payment tool works

**Test Input:**
```
Simulate an x402 payment of 100 TRAC for a high-quality supply chain risk assessment
```

**Expected Behavior:**
- Agent uses `x402_simulate_payment` tool
- Returns simulation results with mock transaction hash
- Explains incentive reasoning

**Status:** 🔧 NEEDS TESTING

---

## Environment Setup Checklist

### Required Environment Variables
- [ ] `DATABASE_URL` - SQLite database path
- [ ] `DKG_PUBLISH_WALLET` - Private key for DKG operations
- [ ] `DKG_BLOCKCHAIN` - Blockchain network (e.g., `otp:20430` for testnet)
- [ ] `DKG_OTNODE_URL` - OT-node URL (e.g., `https://v6-pegasus-node-02.origin-trail.network:8900`)
- [ ] `PORT` - Server port (default: 9200)
- [ ] `EXPO_PUBLIC_APP_URL` - App URL (default: http://localhost:9200)
- [ ] `EXPO_PUBLIC_MCP_URL` - MCP URL (default: http://localhost:9200)

### Required for DeepAgents
- [ ] `ANTHROPIC_API_KEY` OR `OPENAI_API_KEY` OR `GEMINI_API_KEY` - LLM API key
- [ ] `TAVILY_API_KEY` (optional) - For web search

### Check Current Environment
```bash
cd dkg-node/apps/agent
cat .env | grep -E "(API_KEY|DKG_|DATABASE)"
```

---

## Troubleshooting Guide

### Issue: "Tool run not found"
**Symptoms:** Agent can't find knowledge-miner.run

**Possible Causes:**
1. Plugin not loaded
2. Tool registration failed
3. Server needs restart

**Solutions:**
```bash
# Rebuild plugin
cd packages/plugin-deepagents-knowledge-miner
npm run build

# Restart server
# Stop process 17 and restart
```

### Issue: DeepAgents execution fails
**Symptoms:** Tool starts but agent errors out

**Possible Causes:**
1. Missing API keys
2. DeepAgents dependencies not installed
3. Network issues

**Solutions:**
```bash
# Check API keys
echo $ANTHROPIC_API_KEY
echo $OPENAI_API_KEY

# Reinstall dependencies
cd packages/plugin-deepagents-knowledge-miner
npm install --legacy-peer-deps
npm run build
```

### Issue: Panel doesn't appear
**Symptoms:** No DeepAgentsPanel visible in chat

**Possible Causes:**
1. Agent response doesn't include deepagents-meta
2. UI component not rendering
3. State not updating

**Solutions:**
1. Check agent response format
2. Verify extractDeepAgentsMeta function
3. Check browser console for errors

### Issue: Interrupt not working
**Symptoms:** Buttons don't trigger resume

**Possible Causes:**
1. handleDeepAgentsDecisions not wired correctly
2. knowledge-miner.resume tool not found
3. Thread ID mismatch

**Solutions:**
1. Check chat.tsx integration
2. Verify tool registration
3. Check console logs for errors

---

## Success Criteria

### Minimum Viable Product (MVP)
- [ ] Tools are registered and discoverable
- [ ] Agent can call knowledge-miner.run
- [ ] Basic research task completes
- [ ] DeepAgentsPanel displays metadata
- [ ] No critical errors in console

### Full Feature Set
- [ ] All tools work (internet_search, dkg_search, dkg_link, x402_simulate)
- [ ] Interrupt mechanism works
- [ ] Approve/Reject buttons function correctly
- [ ] Memory persistence works
- [ ] Multiple sessions can run concurrently
- [ ] Error handling is robust

### Production Ready
- [ ] Comprehensive error handling
- [ ] User documentation complete
- [ ] Performance is acceptable
- [ ] Security review passed
- [ ] Tests written and passing

---

## Next Steps

### Immediate (Now)
1. **Test basic tool invocation**
   - Login to chat interface
   - Try simple knowledge mining request
   - Verify tool is called

2. **Check for errors**
   - Review server logs
   - Check browser console
   - Note any issues

3. **Document findings**
   - Update this testing plan with results
   - Note any bugs or issues
   - Create tickets for fixes

### Short Term (Today)
4. **Add API keys if missing**
   - Check .env file
   - Add ANTHROPIC_API_KEY or OPENAI_API_KEY
   - Restart server

5. **Test interrupt flow**
   - Trigger human-in-the-loop
   - Test approve/reject buttons
   - Verify resume works

6. **Review and improve**
   - Based on test results
   - Fix any issues found
   - Enhance error messages

### Medium Term (This Week)
7. **Complete all Phase 4 tests**
8. **Add comprehensive error handling**
9. **Write user documentation**
10. **Create demo video**

---

## Test Results Log

### Test Session 1: [Date/Time]
**Tester:** [Name]
**Environment:** [Dev/Staging/Prod]

| Test ID | Status | Notes |
|---------|--------|-------|
| 1.1 | ✅ | Server running |
| 1.2 | 🔧 | Pending |
| 1.3 | 🔧 | Pending |
| ... | ... | ... |

**Issues Found:**
1. [Issue description]
2. [Issue description]

**Overall Assessment:**
[Summary of test session]

---

**Last Updated:** 2025-11-15
**Current Status:** Ready for Phase 1 & 2 testing
