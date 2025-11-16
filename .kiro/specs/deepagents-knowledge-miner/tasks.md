# Implementation Plan

- [ ] 1. Set up plugin package structure
  - Create `packages/plugin-deepagents-knowledge-miner/` directory
  - Create `package.json` with dependencies (deepagents, langchain, @langchain/openai, @langchain/langgraph-checkpoint, zod)
  - Create `tsconfig.json` extending workspace TypeScript config
  - Create `src/` directory for source files
  - _Requirements: 7.2, 7.3_

- [ ] 2. Implement DKG and external tools for DeepAgents
  - [ ] 2.1 Create dkg_get_asset tool
    - Define tool with name "dkg_get_asset"
    - Add description: "Fetch a Knowledge Asset from the OriginTrail DKG by its UAL"
    - Create Zod schema with ual parameter (string)
    - Implement func that calls ctx.dkg.asset.get(ual)
    - _Requirements: 4.1_

  - [ ] 2.2 Create dkg_sparql tool
    - Define tool with name "dkg_sparql"
    - Add description: "Run a SPARQL query against the OriginTrail DKG graph for structured mining and finding related entities"
    - Create Zod schema with query parameter (string)
    - Implement func that calls ctx.dkg.graph.query(query)
    - _Requirements: 4.2_

  - [ ] 2.3 Create dkg_get_asset_metadata tool
    - Define tool with name "dkg_get_asset_metadata"
    - Add description: "Get ERC-721 metadata including stake amount, publisher, and trust signals"
    - Create Zod schema with ual parameter (string)
    - Implement func that extracts tokenId from UAL and queries blockchain for metadata (stakeAmount, publisher, publishTime, updateCount)
    - _Requirements: 4.3, 12.1_

  - [ ] 2.4 Create tavily_search tool
    - Define tool with name "tavily_search"
    - Add description: "Search the web for real-time information using Tavily API"
    - Create Zod schema with query (string) and maxResults (number, optional) parameters
    - Implement func that calls Tavily API with Authorization header using process.env.TAVILY_API_KEY
    - _Requirements: 4.4_

- [ ] 3. Implement subagent configurations
  - [ ] 3.1 Create discovery subagent configuration
    - Set name to "discovery"
    - Write description: "Collect raw signals and candidate facts from DKG and the open web"
    - Write system prompt instructing agent to:
      - Use write_todos to plan discovery strategy before starting
      - Understand domain tags and mine DKG via SPARQL and asset retrieval
      - Use tavily_search for real-time web information when DKG data is insufficient
      - Offload large search results to filesystem using write_file
      - Spawn subagents via task tool for complex research subtasks
      - Read/write /memories/knowledge/<domainTag>/discovery-notes.md
    - Assign tools: [dkgSparql, dkgGetAsset, tavilySearch] (built-in tools: write_todos, write_file, read_file, edit_file, task, ls)
    - _Requirements: 2.2, 4.5, 9.1, 9.2, 14.1, 14.2, 14.3, 14.4, 14.5_

  - [ ] 3.2 Create enrichment subagent configuration
    - Set name to "enrichment"
    - Write description: "Normalize, structure and enrich raw signals into candidate Knowledge Assets with proper linking"
    - Write system prompt instructing agent to:
      - Use write_todos to plan enrichment and linking strategy
      - Clean and normalize information from discovery
      - Query DKG via SPARQL to find related entities for linking
      - Provide linking signals via UALs in JSON-LD (e.g., "relatedTo": { "@id": "did:dkg:..." })
      - Use semantic relationships (schema:supplier, schema:partOf, dkg:derivedFrom)
      - Include linkedAssets array with UALs in output
      - Use /memories/knowledge/<domainTag>/schema-notes.md for patterns and linking heuristics
      - Spawn subagents for complex entity resolution tasks
    - Assign tools: [dkgGetAsset, dkgSparql] (built-in tools: write_todos, write_file, read_file, edit_file, task, ls)
    - _Requirements: 2.3, 4.6, 9.3, 9.4, 11.1, 11.2, 11.3, 11.4, 11.5_

  - [ ] 3.3 Create validation subagent configuration
    - Set name to "validation"
    - Write description: "Validate candidate Knowledge Assets against DKG, learned heuristics, and trust/tokenomics signals"
    - Write system prompt instructing agent to:
      - Use write_todos to plan validation strategy
      - Check internal consistency and detect duplicates via SPARQL
      - Query asset metadata to check TRAC stake amounts (higher stake = higher trust)
      - Verify publisher reputation via ERC-721 token ownership
      - Use stake amounts as confidence multipliers (e.g., >50K TRAC gets +0.2 confidence)
      - Assign confidence scores (0.0-1.0) based on quality, reliability, stake/trust, consistency
      - Include trustSignals in output (confidence, linkedToHighStakeAssets, averageLinkedStake)
      - Use /memories/knowledge/<domainTag>/validation-rules.md for heuristics and stake thresholds
      - Generate synthesized validation report with reasoning
    - Assign tools: [dkgGetAsset, dkgSparql, dkgGetAssetMetadata] (built-in tools: write_todos, write_file, read_file, edit_file, task, ls)
    - _Requirements: 2.4, 4.7, 9.5, 9.6, 12.1, 12.2, 12.3, 12.4, 12.5, 15.1, 15.2, 15.3, 15.4, 15.5_

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
    - Write main system prompt explaining COMMUNITY NOTES KNOWLEDGE MINER behavior, domain-agnostic approach, subagent workflow, long-term memory usage, and JSON output contract
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
    - Ensure response contains summary, candidateAssets, domainTags, memoryWrites, todos, spawnedSubagents, filesystemFiles, synthesizedReport fields
    - Ensure candidateAssets include linkedAssets and trustSignals fields
    - Return formatted content as MCP tool result
    - _Requirements: 6.5, 11.5, 12.5, 13.3, 15.5_

- [ ] 6. Integrate plugin with server
  - [ ] 6.1 Import plugin in server index
    - Add import statement for deepAgentsKnowledgeMinerPlugin in apps/agent/src/server/index.ts
    - _Requirements: 7.5_

  - [ ] 6.2 Register plugin in plugins array
    - Add deepAgentsKnowledgeMinerPlugin to the plugins array in createPluginServer call
    - Position after dkgEssentialsPlugin
    - _Requirements: 7.5_

  - [ ] 6.3 Add environment variable configuration
    - Document DEEPAGENTS_MODEL in .env file with default gpt-4o-mini
    - Document TAVILY_API_KEY in .env file for web search
    - _Requirements: 8.1, 8.2_

- [ ] 7. Implement Chat UI enhancements
  - [ ] 7.1 Add state management
    - Add useState hook for domainTags (string array)
    - Add useState hook for agentWorkspace (object with todos, spawnedSubagents, filesystemFiles, memoryWrites, synthesizedReport)
    - Add useState hook for showWorkspace (boolean)
    - Implement toggleDomainTag function to add/remove tags
    - _Requirements: 5.2, 13.1_

  - [ ] 7.2 Create tag bar UI component
    - Add View container with flexDirection row, flexWrap, and alignItems center
    - Add Text label "Knowledge Miner tags"
    - Create Button for #supply_chain tag with conditional styling (primary when selected, card otherwise)
    - Create Button for #general_risk tag with conditional styling
    - Add "Show/Hide Workspace" toggle button with marginLeft auto
    - Position tag bar between Header and Chat.Messages
    - _Requirements: 5.1, 5.4, 13.4_

  - [ ] 7.3 Create Agent Workspace visualization panel
    - Add conditional View that renders when showWorkspace && agentWorkspace
    - Style with backgroundColor card, padding 16, borderRadius 8, marginBottom 16
    - Add "Agent Workspace" title with fontSize 18 and fontWeight bold
    - Create section for todos with 📋 icon showing each todo item
    - Create section for spawnedSubagents with 🤖 icon showing name, task, and status
    - Create section for filesystemFiles with 📁 icon showing path and size in KB
    - Create section for memoryWrites with 💾 icon showing each path
    - Create section for synthesizedReport with 📊 icon showing report text
    - _Requirements: 13.1, 13.2, 13.3_

  - [ ] 7.4 Inject tags into user messages
    - Modify sendMessage function to check if newMessage.role is "user" and domainTags.length > 0
    - Create tag prefix by joining tags with space (e.g., "#supply_chain #general_risk")
    - Map over message contents and prepend tag prefix to text content
    - Update newMessage with modified content
    - _Requirements: 5.3, 5.5_

  - [ ] 7.5 Update workspace from tool results
    - After knowledge-miner tool call completes, parse tc.info.output
    - Extract todos, spawnedSubagents, filesystemFiles, memoryWrites, synthesizedReport from JSON
    - Call setAgentWorkspace with extracted data
    - Call setShowWorkspace(true) to auto-show workspace when data is available
    - _Requirements: 13.2, 13.5_

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
    - Initialize InMemoryStore for memory persistence
    - Create CompositeBackend with StateBackend and StoreBackend mounted at /memories/
    - Create DKG tools (dkg_get_asset, dkg_sparql, dkg_get_asset_metadata)
    - Create tavily_search tool
    - Define subagent configurations (discovery, enrichment, validation)
    - Create DeepAgent harness with model, tools, backend, store, subagents, and main system prompt
    - Register knowledge-miner MCP tool with handler
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2_

- [ ] 10. Implement human-in-the-loop approval (optional enhancement)
  - [ ] 10.1 Configure interrupt_on for sensitive operations
    - Add interruptOn parameter to createDeepAgent config
    - Set dkg_publish_asset to require approval with allowedDecisions: ["approve", "edit", "reject"]
    - Set read-only operations (dkg_get_asset, dkg_sparql, tavily_search) to false
    - Add MemorySaver checkpointer (required for interrupts)
    - _Requirements: 16.1, 16.2_

  - [ ] 10.2 Add UI for pending approvals
    - Add useState hook for pendingApproval (object with actionName, args, allowedDecisions)
    - Create conditional View that renders when pendingApproval exists
    - Display action name and arguments
    - Add Approve, Edit, and Reject buttons
    - Implement handleDecision function to resume agent with Command({ resume: { decisions } })
    - _Requirements: 16.3, 16.4, 16.5_

- [ ]* 11. Write unit tests
  - Create tests/ directory in plugin package
  - Write test for plugin registration
  - Write test for DKG tool creation (all 3 tools)
  - Write test for tavily_search tool
  - Write test for thread ID generation from domain tags
  - Write test for JSON response parsing with all new fields
  - Write test for trust signal calculation
  - Mock ctx.dkg, Tavily API, and DeepAgents dependencies
  - _Requirements: All_

- [ ]* 12. Write integration tests
  - Create integration test file in apps/agent/tests/integration/
  - Test end-to-end knowledge mining flow with web search
  - Test multi-run memory persistence across threads
  - Test domain tag isolation (different thread IDs)
  - Test UI tag injection and workspace updates
  - Test linking to existing DKG assets
  - Test trust signal calculation with stake amounts
  - Test human-in-the-loop approval workflow
  - _Requirements: All_
