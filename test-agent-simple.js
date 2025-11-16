// Test if the agent works at all
const { createDeepAgent } = require('deepagents');

async function test() {
  console.log('Creating agent...');
  const agent = createDeepAgent({
    systemPrompt: 'You are a helpful assistant. Answer briefly.',
    tools: [],
    model: 'claude-sonnet-4-20250514',
  });
  
  console.log('Agent created, invoking...');
  
  const timeout = setTimeout(() => {
    console.log('❌ TIMEOUT after 30 seconds');
    process.exit(1);
  }, 30000);
  
  try {
    const result = await agent.invoke({
      messages: [{ role: 'user', content: 'What is 2+2?' }]
    }, {
      configurable: { thread_id: 'test-123' }
    });
    
    clearTimeout(timeout);
    console.log('✅ Result:', JSON.stringify(result, null, 2));
  } catch (err) {
    clearTimeout(timeout);
    console.error('❌ Error:', err.message);
  }
}

test();
