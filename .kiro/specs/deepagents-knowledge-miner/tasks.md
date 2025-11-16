# Implementation Plan

- [ ] 1. Set up plugin package structure
  - Create `packages/plugin-deepagents-knowledge-miner/` directory
  - Create `package.json` with dependencies (deepagents, langchain, @langchain/openai, @langchain/langgraph-checkpoint, zod)
  - Create `tsconfig.json` extending workspace TypeScript config
  - Create `src/` directory for source files
  - _Requirements: 7.2, 7.3_

- [ ] 2. Implement DKG tools for DeepAgents
  - [ ] 2.1 Create dkg_get_asset tool
    - Define tool with name "dkg_get_asset"
    - Add description: "Fetch a Knowledge Asset from the OriginTrail DKG by its UAL"
    - Create Zod schema with ual parameter (string)
    - Implement func that calls ctx.dkg.asset.get(ual)
    - _Requirements: 4.1_

  - [ ] 2.2 Create dkg_sparql tool
    - Define tool with name "dkg_sparql"
    - Add description: "Run a SPARQL query against the OriginTrail DKG graph"
    - Create Zod schema with query parameter (string)
    - Implement func that calls ctx.dkg.graph.query(query)
    - _Requirements: 4.2_

- [ ] 3. Implement subagent configurations
  - [ ] 3.1 Create discovery subagent configuration
    - Set name to "discovery"
    - Write description: "Collect raw signals and candidate facts from DKG and the open web"
    - Write system prompt instructing agent to understand domain tags, mine DKG/web, read/write /memories/knowledge/<domainTag>/discovery-notes.md
    - Assign tools: [dkgSparql, dkgGetAsset]
    - _Requirements: 2.2, 9.1, 9.2_

  - [ ] 3.2 Create enrichment subagent configuration
    - Set name to "enrichment"
    - Write description: "Normalize, structure and enrich raw signals into candidate Knowledge Assets"
    - Write system prompt instructing agent to clean data, propose JSON-LD KAs, use /memories/knowledge/<domainTag>/schema-notes.md
    - Assign tools: [dkgGetAsset, dkgSparql]
    - _Requirements: 2.3, 9.3, 9.4_

  - [ ] 3.3 Create validation subagent configuration
    - Set name to "validation"
    - Write description: "Validate candidate Knowledge Assets against DKG and learned heuristics"
    - Write system prompt instructing agent to check consistency, detect duplicates, assign confidence scores, use /memories/knowledge/<domainTag>/validation-rules.md
    - Assign tools: [dkgGetAsset, dkgSparql]
    - _Requirements: 2.4, 9.5, 9.6_

- [ ] 4. Implement DeepAgents harness initialization
  - [ ] 4.1 Configure memory backend
    - Create InMemoryStore instance
    - Create CompositeBackend with StateBackend and StoreBackend mounted at /memories/
    - _Requirements: 3.1, 3.2_

  - [ ] 4.2 Configure base LLM
    - Create ChatOpenAI instance
    - Read model from process.env.DEEPAGENTS_MODEL with fallback to "gpt-4o-mini"
    - Set temperature to 0.2
    - _Requirements: 8.1, 8.2, 8.4_

  - [ ] 4.3 Create DeepAgent harness
    - Call createDeepAgent with model, tools, backend, store, subagents
    - Write main system prompt explaining RISKWISE KNOWLEDGE MINER behavior, domain-agnostic approach, subagent workflow, long-term memory usage, and JSON output contract
    - Store agent promise for reuse across tool calls
    - _Requirements: 2.1, 2.5, 3.3_

- [ ] 5. Implement knowledge-miner MCP tool
  - [ ] 5.1 Register MCP tool with schema
    - Call mcp.registerTool with name "knowledge-miner"
    - Set title: "DeepAgents Knowledge Miner"
    - Write description explaining multi-agent workflow and domain-agnostic nature
    - Define inputSchema with query (string), domainTags (array of strings, optional), maxIterations (integer 1-10, optional)
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ] 5.2 Implement tool handler
    - Generate thread ID from sorted domain tags joined with "__" or "global" if no tags
    - Build prompt with domain tags line and user query
    - Invoke DeepAgent with messages and configurable (thread_id, max_iterations)
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [ ] 5.3 Parse and format response
    - Extract last message content from agent result
    - Parse JSON response with try-catch fallback
    - Ensure response contains summary, candidateAssets, domainTags, memoryWrites fields
    - Return formatted content as MCP tool result
    - _Requirements: 6.5_

- [ ] 6. Integrate plugin with server
  - [ ] 6.1 Import plugin in server index
    - Add import statement for deepAgentsKnowledgeMinerPlugin in apps/agent/src/server/index.ts
    - _Requirements: 7.5_

  - [ ] 6.2 Register plugin in plugins array
    - Add deepAgentsKnowledgeMinerPlugin to the plugins array in createPluginServer call
    - Position after dkgEssentialsPlugin
    - _Requirements: 7.5_

  - [ ] 6.3 Add environment variable configuration
    - Document DEEPAGENTS_MODEL in .env file
    - Set default value to gpt-4o-mini
    - _Requirements: 8.1, 8.2_

- [ ] 7. Implement Chat UI domain tag selection
  - [ ] 7.1 Add state management for domain tags
    - Add useState hook for domainTags (string array)
    - Implement toggleDomainTag function to add/remove tags
    - _Requirements: 5.2_

  - [ ] 7.2 Create tag bar UI component
    - Add View container with flexDirection row and flexWrap
    - Add Text label "Knowledge Miner tags"
    - Create Button for #supply_chain tag with conditional styling
    - Create Button for #general_risk tag with conditional styling
    - Position tag bar between Header and Chat.Messages
    - _Requirements: 5.1, 5.4_

  - [ ] 7.3 Inject tags into user messages
    - Modify sendMessage function to check if newMessage.role is "user" and domainTags.length > 0
    - Create tag prefix by joining tags with space (e.g., "#supply_chain #general_risk")
    - Map over message contents and prepend tag prefix to text content
    - Update newMessage with modified content
    - _Requirements: 5.3, 5.5_

- [ ] 8. Add workspace dependencies
  - Run npm install in workspace root to link new plugin package
  - Verify deepagents and related dependencies are installed
  - Build plugin package with npm run build
  - _Requirements: 7.1_

- [ ] 9. Create plugin main entry point
  - [ ] 9.1 Write plugin definition
    - Export default defineDkgPlugin function
    - Accept ctx and mcp parameters
    - Extract dkg from ctx.dkg
    - _Requirements: 7.3, 7.4_

  - [ ] 9.2 Wire all components together
    - Initialize memory store and backend
    - Create DKG tools
    - Define subagent configurations
    - Create DeepAgent harness
    - Register knowledge-miner MCP tool
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ]* 10. Write unit tests
  - Create tests/ directory in plugin package
  - Write test for plugin registration
  - Write test for DKG tool creation
  - Write test for thread ID generation
  - Write test for JSON response parsing
  - Mock ctx.dkg and DeepAgents dependencies
  - _Requirements: All_

- [ ]* 11. Write integration tests
  - Create integration test file in apps/agent/tests/integration/
  - Test end-to-end knowledge mining flow
  - Test multi-run memory persistence
  - Test domain tag isolation
  - Test UI tag injection
  - _Requirements: All_
