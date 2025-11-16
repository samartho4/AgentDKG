// Quick test to see if the knowledge miner tool works
const fetch = require('node-fetch');

async function testTool() {
  try {
    console.log('Testing knowledge miner tool...');
    console.log('TAVILY_API_KEY:', process.env.TAVILY_API_KEY ? 'SET' : 'NOT SET');
    
    // Just test if Tavily API is accessible
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY || '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',
        query: 'test query',
        max_results: 1
      })
    });
    
    console.log('Response status:', response.status);
    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
  }
}

testTool();
