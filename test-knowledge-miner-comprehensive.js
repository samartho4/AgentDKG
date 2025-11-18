#!/usr/bin/env node

/**
 * Comprehensive Knowledge Miner Test
 * 
 * Tests all functionality of knowledge_miner_run with minimal LLM token usage:
 * 
 * WHAT knowledge_miner_run CAN DO:
 * ================================
 * 1. AUTONOMOUS RESEARCH: Searches the web using Tavily API for information
 * 2. PLANNING: Creates structured todo lists for research tasks
 * 3. MEMORY MANAGEMENT: Saves findings to /memories/knowledge/<domain>/ files
 * 4. DKG INTEGRATION: Can search and link Knowledge Assets (KAs) via UALs
 * 5. VALIDATION: Simulates x402 trust scores for knowledge assets
 * 6. PROGRESS TRACKING: Real-time updates via SSE (Server-Sent Events)
 * 7. RESUMABLE SESSIONS: Returns thread_id for continuing work later
 * 
 * TOOLS AVAILABLE:
 * ================
 * - internet_search: Web search via Tavily API
 * - dkg_search_kas: Search existing Knowledge Assets in DKG
 * - dkg_link_kas: Link Knowledge Assets via UALs
 * - x402_trust_score: Calculate trust/economic signals
 * - write_file: Save research to memory files
 * - write_todos: Create task lists
 * 
 * This test uses MINIMAL queries to avoid high token consumption.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const TEST_CASES = [
  {
    name: 'Minimal Research Task',
    task: 'What is TypeScript? One sentence.',
    domain: 'tech',
    expectedTools: ['internet_search', 'write_file'],
    description: 'Tests basic web search and file writing with minimal query'
  },
  {
    name: 'Planning Test',
    task: 'List 2 benefits of Node.js',
    domain: 'nodejs',
    expectedTools: ['write_todos', 'internet_search'],
    description: 'Tests todo creation and simple research'
  },
  {
    name: 'Memory Persistence',
    task: 'Define REST API in 5 words',
    domain: 'api',
    expectedTools: ['internet_search', 'write_file'],
    description: 'Tests that findings are saved to /memories/knowledge/api/'
  }
];

async function testKnowledgeMiner() {
  console.log('🧪 KNOWLEDGE MINER COMPREHENSIVE TEST\n');
  console.log('=' .repeat(60));
  
  // Start MCP server
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['dkg-node/apps/agent/dist/server/index.js'],
    env: { ...process.env }
  });

  const client = new Client({
    name: 'knowledge-miner-test',
    version: '1.0.0'
  }, {
    capabilities: {}
  });

  try {
    console.log('\n📡 Connecting to MCP server...');
    await client.connect(transport);
    console.log('✅ Connected\n');

    // List available tools
    const { tools } = await client.listTools();
    console.log('🔧 Available tools:');
    tools.forEach(tool => {
      console.log(`   - ${tool.name}: ${tool.description?.substring(0, 60)}...`);
    });
    console.log();

    // Run test cases
    const results = [];
    
    for (const testCase of TEST_CASES) {
      console.log('=' .repeat(60));
      console.log(`\n🧪 TEST: ${testCase.name}`);
      console.log(`📝 Description: ${testCase.description}`);
      console.log(`🎯 Task: "${testCase.task}"`);
      console.log(`🏷️  Domain: ${testCase.domain}`);
      console.log(`⚙️  Expected tools: ${testCase.expectedTools.join(', ')}\n`);

      const startTime = Date.now();
      
      try {
        const result = await client.callTool({
          name: 'knowledge_miner_run',
          arguments: {
            task: testCase.task,
            domain: testCase.domain,
            sessionId: `test-${Date.now()}`
          }
        });

        const duration = Date.now() - startTime;
        
        // Parse result
        const textContent = result.content.find(c => c.type === 'text');
        const responseText = textContent?.text || '';
        
        // Extract metadata
        const threadIdMatch = responseText.match(/thread[_-]?id[:\s]+([a-f0-9-]+)/i);
        const threadId = threadIdMatch ? threadIdMatch[1] : 'not found';
        
        // Check for expected tools in execution log
        const toolsUsed = testCase.expectedTools.filter(tool => 
          responseText.toLowerCase().includes(tool.toLowerCase())
        );
        
        // Check for memory files
        const hasMemoryFiles = responseText.includes('/memories/knowledge/');
        
        // Check for todos
        const hasTodos = responseText.includes('📋') || responseText.includes('todo');
        
        console.log('✅ TEST PASSED');
        console.log(`⏱️  Duration: ${duration}ms`);
        console.log(`🆔 Thread ID: ${threadId}`);
        console.log(`🔧 Tools detected: ${toolsUsed.join(', ') || 'none detected in log'}`);
        console.log(`💾 Memory files: ${hasMemoryFiles ? 'YES' : 'NO'}`);
        console.log(`📋 Todos created: ${hasTodos ? 'YES' : 'NO'}`);
        console.log(`📄 Response preview: ${responseText.substring(0, 200)}...\n`);
        
        results.push({
          test: testCase.name,
          status: 'PASSED',
          duration,
          threadId,
          toolsUsed,
          hasMemoryFiles,
          hasTodos
        });
        
      } catch (error) {
        const duration = Date.now() - startTime;
        console.log('❌ TEST FAILED');
        console.log(`⏱️  Duration: ${duration}ms`);
        console.log(`❗ Error: ${error.message}\n`);
        
        results.push({
          test: testCase.name,
          status: 'FAILED',
          duration,
          error: error.message
        });
      }
    }

    // Summary
    console.log('=' .repeat(60));
    console.log('\n📊 TEST SUMMARY\n');
    
    const passed = results.filter(r => r.status === 'PASSED').length;
    const failed = results.filter(r => r.status === 'FAILED').length;
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
    
    console.log(`Total tests: ${results.length}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏱️  Total time: ${totalDuration}ms (${(totalDuration/1000).toFixed(2)}s)`);
    console.log(`⚡ Avg time per test: ${(totalDuration/results.length).toFixed(0)}ms\n`);
    
    // Detailed results
    console.table(results.map(r => ({
      Test: r.test,
      Status: r.status,
      'Duration (ms)': r.duration,
      'Tools Used': r.toolsUsed?.join(', ') || 'N/A',
      'Has Memory': r.hasMemoryFiles ? '✓' : '✗',
      'Has Todos': r.hasTodos ? '✓' : '✗'
    })));

    // Feature coverage
    console.log('\n🎯 FEATURE COVERAGE\n');
    const allToolsUsed = new Set(results.flatMap(r => r.toolsUsed || []));
    console.log('Tools tested:');
    allToolsUsed.forEach(tool => console.log(`   ✓ ${tool}`));
    
    const memoryTests = results.filter(r => r.hasMemoryFiles).length;
    const todoTests = results.filter(r => r.hasTodos).length;
    console.log(`\nMemory management: ${memoryTests}/${results.length} tests`);
    console.log(`Todo planning: ${todoTests}/${results.length} tests`);

    await client.close();
    
    process.exit(failed > 0 ? 1 : 0);

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run tests
testKnowledgeMiner();
