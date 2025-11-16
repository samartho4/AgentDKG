// Test script to check if MCP tools are registered
const https = require('https');
const http = require('http');

function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    
    const req = client.request(url, {
      method: options.method || 'GET',
      headers: options.headers || {},
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          json: () => Promise.resolve(JSON.parse(data)),
          headers: {
            get: (name) => res.headers[name.toLowerCase()]
          }
        });
      });
    });
    
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function testMCPTools() {
  const baseUrl = 'http://localhost:9200';
  
  // Step 1: Initialize session
  console.log('1. Initializing MCP session...');
  const initResponse = await fetch(`${baseUrl}/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'test-client',
          version: '1.0.0'
        }
      }
    })
  });
  
  const initData = await initResponse.json();
  console.log('Init response:', JSON.stringify(initData, null, 2));
  
  const sessionId = initResponse.headers.get('mcp-session-id');
  console.log('Session ID:', sessionId);
  
  if (!sessionId) {
    console.error('No session ID received!');
    return;
  }
  
  // Step 2: List tools
  console.log('\n2. Listing tools...');
  const toolsResponse = await fetch(`${baseUrl}/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'mcp-session-id': sessionId
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {}
    })
  });
  
  const toolsData = await toolsResponse.json();
  console.log('Tools response:', JSON.stringify(toolsData, null, 2));
  
  // Check for knowledge-miner tools
  if (toolsData.result && toolsData.result.tools) {
    const knowledgeMinerTools = toolsData.result.tools.filter(t => 
      t.name.includes('knowledge-miner')
    );
    console.log('\nKnowledge Miner tools found:', knowledgeMinerTools.length);
    knowledgeMinerTools.forEach(tool => {
      console.log(`  - ${tool.name}: ${tool.description}`);
    });
  }
}

testMCPTools().catch(console.error);
