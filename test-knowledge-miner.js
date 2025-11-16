#!/usr/bin/env node

/**
 * Test script to verify knowledge_miner_run tool is working
 * and produces the deepagents-meta block for the UI panel
 */

// Use native fetch in Node 18+
const fetch = globalThis.fetch || require('node-fetch');

const MCP_URL = 'http://localhost:9200';

async function testKnowledgeMiner() {
  console.log('🧪 Testing Knowledge Miner Tool\n');
  
  // Step 1: Login to get token
  console.log('1. Logging in...');
  const loginRes = await fetch(`${MCP_URL}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'password',
      username: 'samarthx04@gmail.com',
      password: 'AgentDKG',
      scope: 'mcp'
    })
  });
  
  if (!loginRes.ok) {
    console.error('❌ Login failed:', await loginRes.text());
    return;
  }
  
  const { access_token } = await loginRes.json();
  console.log('✅ Logged in\n');
  
  // Step 2: List available tools
  console.log('2. Checking available tools...');
  const toolsRes = await fetch(`${MCP_URL}/mcp/tools/list`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({})
  });
  
  const { tools } = await toolsRes.json();
  const kmTool = tools.find(t => t.name === 'knowledge_miner_run');
  
  if (!kmTool) {
    console.error('❌ knowledge_miner_run tool not found!');
    console.log('Available tools:', tools.map(t => t.name));
    return;
  }
  
  console.log('✅ Found knowledge_miner_run tool\n');
  
  // Step 3: Call the tool
  console.log('3. Calling knowledge_miner_run...');
  console.log('   Task: "Quick test of TSMC"');
  console.log('   (This will take 30-60 seconds)\n');
  
  const sessionId = 'test-' + Date.now();
  
  const callRes = await fetch(`${MCP_URL}/mcp/tools/call`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'knowledge_miner_run',
      arguments: {
        task: 'Quick test research on TSMC',
        domain: 'supply-chain',
        sessionId: sessionId
      }
    })
  });
  
  if (!callRes.ok) {
    console.error('❌ Tool call failed:', await callRes.text());
    return;
  }
  
  const result = await callRes.json();
  console.log('✅ Tool completed!\n');
  
  // Step 4: Check the response
  console.log('4. Checking response format...\n');
  
  const content = result.content[0]?.text || '';
  
  // Check for execution log
  if (content.includes('📊 Execution Log')) {
    console.log('✅ Execution log present');
  } else {
    console.log('❌ Execution log missing');
  }
  
  // Check for deepagents-meta block
  if (content.includes('```deepagents-meta')) {
    console.log('✅ deepagents-meta block present');
    
    // Extract and parse metadata
    const match = content.match(/```deepagents-meta\n([\s\S]*?)\n```/);
    if (match) {
      try {
        const meta = JSON.parse(match[1]);
        console.log('\n📊 Metadata:');
        console.log('   Thread ID:', meta.threadId);
        console.log('   Type:', meta.type);
        console.log('   Todos:', meta.todos?.length || 0);
        console.log('   Files:', meta.allFiles?.length || 0);
        console.log('   Tools Used:', meta.toolsUsed?.length || 0);
        console.log('   Tool Executions:', meta.toolExecutions?.length || 0);
        
        if (meta.toolExecutions && meta.toolExecutions.length > 0) {
          console.log('\n🔧 Tools Executed:');
          meta.toolExecutions.forEach((exec, idx) => {
            console.log(`   ${idx + 1}. ${exec.name}`);
          });
        }
        
        console.log('\n✅ Panel should appear in UI with this data!');
      } catch (e) {
        console.log('❌ Failed to parse metadata:', e.message);
      }
    }
  } else {
    console.log('❌ deepagents-meta block missing - Panel will NOT appear!');
  }
  
  // Show a preview of the response
  console.log('\n📄 Response Preview (first 500 chars):');
  console.log(content.substring(0, 500) + '...\n');
  
  console.log('✅ Test complete!');
  console.log('\nTo see the panel in UI:');
  console.log('1. Open http://localhost:8081/chat');
  console.log('2. Type: "Run a knowledge mining session to research TSMC"');
  console.log('3. The DeepAgentsPanel should appear after completion');
}

testKnowledgeMiner().catch(console.error);
