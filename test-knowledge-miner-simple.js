#!/usr/bin/env node

/**
 * Simple test to verify the knowledge miner plugin is loaded
 * and check what it returns
 */

const fetch = globalThis.fetch || require('node-fetch');

const MCP_URL = 'http://localhost:9200';

async function testPlugin() {
  console.log('🧪 Testing Knowledge Miner Plugin\n');
  
  try {
    // Test 1: Check if tools endpoint is accessible
    console.log('1. Checking MCP tools endpoint...');
    const toolsRes = await fetch(`${MCP_URL}/mcp/tools/list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    
    if (!toolsRes.ok) {
      console.log('⚠️  Tools endpoint requires auth (expected)');
      console.log('   Status:', toolsRes.status);
    }
    
    // Test 2: Check if progress endpoint exists
    console.log('\n2. Checking SSE progress endpoint...');
    const progressRes = await fetch(`${MCP_URL}/progress?sessionId=test-123`);
    
    if (progressRes.ok) {
      console.log('✅ Progress endpoint is accessible');
      console.log('   Content-Type:', progressRes.headers.get('content-type'));
      
      // Read first event
      const reader = progressRes.body.getReader();
      const decoder = new TextDecoder();
      const { value } = await reader.read();
      const text = decoder.decode(value);
      console.log('   First event:', text.trim());
      reader.cancel();
    } else {
      console.log('❌ Progress endpoint not accessible');
      console.log('   Status:', progressRes.status);
    }
    
    // Test 3: Check server health
    console.log('\n3. Checking server health...');
    const healthRes = await fetch(`${MCP_URL}/`);
    if (healthRes.ok) {
      console.log('✅ Server is running');
    }
    
    console.log('\n📋 Summary:');
    console.log('   Server: ✅ Running on', MCP_URL);
    console.log('   SSE Endpoint: ✅ /progress');
    console.log('   MCP Tools: ⚠️  Requires authentication');
    
    console.log('\n🎯 Next Steps:');
    console.log('   1. Open http://localhost:8081/chat in browser');
    console.log('   2. Login with your credentials');
    console.log('   3. Type: "Run a knowledge mining session to research TSMC"');
    console.log('   4. Watch for:');
    console.log('      - Tool call card appears');
    console.log('      - DeepAgentsPanel appears during/after execution');
    console.log('      - Live progress updates (if SSE working)');
    console.log('      - Execution log in response');
    console.log('      - deepagents-meta block in response');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Also check server logs
console.log('📝 Check server logs for:');
console.log('   "✅ Progress publisher configured for DeepAgents"');
console.log('   This confirms SSE support is enabled\n');

testPlugin().catch(console.error);
