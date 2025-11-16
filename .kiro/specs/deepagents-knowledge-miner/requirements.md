# Requirements Document

## Introduction

Transform the DKG Node agent from a hard-coded supply chain knowledge miner into a general-purpose, domain-agnostic DeepAgents-powered knowledge mining system. The system will use multi-agent architecture with discovery, enrichment, and validation subagents, integrated with long-term memory capabilities and the OriginTrail Decentralized Knowledge Graph (DKG).

## Glossary

- **DeepAgents**: A multi-agent framework from LangChain that enables hierarchical agent architectures with subagents and persistent memory
- **DKG Node**: The OriginTrail Decentralized Knowledge Graph node application
- **Knowledge Asset (KA)**: A JSON-LD structured data object stored on the DKG
- **MCP (Model Context Protocol)**: A protocol for exposing tools and resources to AI agents
- **CompositeBackend**: A DeepAgents backend that routes different paths to different storage mechanisms
- **StateBackend**: Ephemeral storage for agent state within a single run
- **StoreBackend**: Persistent storage for long-term memory across runs
- **Domain Tag**: A user-specified label (e.g., #supply_chain, #climate) that categorizes knowledge mining operations
- **UAL (Universal Asset Locator)**: A unique identifier for DKG Knowledge Assets
- **SPARQL**: A query language for RDF graph databases used by the DKG
- **Subagent**: A specialized agent within the DeepAgents hierarchy responsible for a specific task

## Requirements

### Requirement 1

**User Story:** As a knowledge engineer, I want to mine knowledge from any domain (not just supply chain), so that I can use the same system for diverse use cases like climate data, procurement, or clinical trials.

#### Acceptance Criteria

1. WHEN the System receives a knowledge mining request, THE System SHALL support arbitrary domain tags without hard-coded domain restrictions
2. THE System SHALL treat supply chain as one optional domain tag among many possible tags
3. WHERE a user provides domain tags, THE System SHALL use those tags to organize memory and context
4. THE System SHALL function correctly when no domain tags are provided

### Requirement 2

**User Story:** As a developer, I want the knowledge miner to use a multi-agent architecture with specialized subagents, so that knowledge discovery, enrichment, and validation are handled by focused, specialized agents.

#### Acceptance Criteria

1. THE System SHALL implement three distinct subagents: discovery, enrichment, and validation
2. THE discovery subagent SHALL collect raw signals and candidate facts from DKG and external sources
3. THE enrichment subagent SHALL normalize and structure raw signals into candidate Knowledge Assets
4. THE validation subagent SHALL verify candidate Knowledge Assets against DKG data and learned heuristics
5. WHEN processing a knowledge mining request, THE System SHALL execute subagents in sequence: discovery → enrichment → validation

### Requirement 3

**User Story:** As a knowledge engineer, I want the system to learn from previous mining operations, so that it improves its heuristics and validation rules over time.

#### Acceptance Criteria

1. THE System SHALL implement a CompositeBackend with StateBackend for ephemeral state and StoreBackend for persistent memory
2. THE System SHALL store long-term memory under the /memories/** path hierarchy
3. WHEN a subagent completes its work, THE System SHALL write learned heuristics to /memories/knowledge/<domainTag>/ paths
4. WHEN starting a new mining operation, THE System SHALL read existing notes from /memories/knowledge/<domainTag>/ paths
5. THE System SHALL organize memory by domain tag to enable domain-specific learning

### Requirement 4

**User Story:** As a knowledge engineer, I want the system to integrate with the OriginTrail DKG and external data sources, so that it can query existing Knowledge Assets, link to them, and gather real-time information.

#### Acceptance Criteria

1. THE System SHALL expose a dkg_get_asset tool that retrieves Knowledge Assets by UAL
2. THE System SHALL expose a dkg_sparql tool that executes SPARQL queries against the DKG graph
3. THE System SHALL expose a dkg_get_asset_metadata tool that retrieves ERC-721 metadata including stake amounts
4. THE System SHALL expose a tavily_search tool that performs web searches for real-time information
5. THE discovery subagent SHALL have access to DKG tools and tavily_search
6. THE enrichment subagent SHALL have access to DKG tools for linking to existing assets
7. THE validation subagent SHALL have access to DKG tools including metadata for trust verification

### Requirement 5

**User Story:** As an end user, I want to specify domain tags in the chat UI, so that I can guide the knowledge miner toward specific domains without writing complex prompts.

#### Acceptance Criteria

1. THE Chat UI SHALL display a tag selection interface with predefined domain tags
2. WHEN a user selects one or more domain tags, THE Chat UI SHALL visually indicate the selected tags
3. WHEN a user sends a message with selected tags, THE System SHALL prefix the message content with the selected tags
4. THE Chat UI SHALL support at minimum the following tags: #supply_chain and #general_risk
5. THE Chat UI SHALL allow users to send messages without selecting any tags

### Requirement 6

**User Story:** As a developer, I want the knowledge miner exposed as an MCP tool, so that it can be called by the LLM agent with structured parameters.

#### Acceptance Criteria

1. THE System SHALL register an MCP tool named "knowledge-miner"
2. THE knowledge-miner tool SHALL accept a query parameter of type string
3. THE knowledge-miner tool SHALL accept an optional domainTags parameter of type array of strings
4. THE knowledge-miner tool SHALL accept an optional maxIterations parameter of type integer between 1 and 10
5. WHEN the knowledge-miner tool completes, THE System SHALL return a JSON response containing summary, candidateAssets, domainTags, and memoryWrites fields

### Requirement 7

**User Story:** As a developer, I want the DeepAgents plugin to be modular and follow the existing plugin architecture, so that it integrates cleanly with the DKG Node codebase.

#### Acceptance Criteria

1. THE System SHALL implement the DeepAgents knowledge miner as a new plugin package
2. THE plugin package SHALL be located at packages/plugin-deepagents-knowledge-miner/
3. THE plugin SHALL use the defineDkgPlugin function to register with the plugin system
4. THE plugin SHALL access DKG functionality through the ctx.dkg context object
5. THE plugin SHALL be registered in the server plugins array in apps/agent/src/server/index.ts

### Requirement 8

**User Story:** As a system administrator, I want the DeepAgents configuration to be controlled via environment variables, so that I can configure the LLM model and other settings without code changes.

#### Acceptance Criteria

1. THE System SHALL read the LLM model name from the DEEPAGENTS_MODEL environment variable
2. WHERE the DEEPAGENTS_MODEL environment variable is not set, THE System SHALL default to "gpt-4o-mini"
3. THE System SHALL use the existing OpenAI API key configuration from the environment
4. THE System SHALL configure the LLM with a temperature of 0.2 for consistent outputs

### Requirement 9

**User Story:** As a knowledge engineer, I want each subagent to have clear responsibilities and system prompts, so that the multi-agent workflow produces high-quality, structured outputs.

#### Acceptance Criteria

1. THE discovery subagent system prompt SHALL instruct it to collect raw signals from DKG and web sources
2. THE discovery subagent system prompt SHALL instruct it to read and write discovery notes to /memories/knowledge/<domainTag>/discovery-notes.md
3. THE enrichment subagent system prompt SHALL instruct it to normalize data and propose JSON-LD Knowledge Assets
4. THE enrichment subagent system prompt SHALL instruct it to maintain schema notes in /memories/knowledge/<domainTag>/schema-notes.md
5. THE validation subagent system prompt SHALL instruct it to check for consistency, duplicates, and missing fields
6. THE validation subagent system prompt SHALL instruct it to maintain validation rules in /memories/knowledge/<domainTag>/validation-rules.md

### Requirement 10

**User Story:** As a developer, I want the system to handle thread management based on domain tags, so that memory is properly segmented across different knowledge domains.

#### Acceptance Criteria

1. WHEN domain tags are provided, THE System SHALL create a thread ID by joining sorted domain tags with "__"
2. WHERE no domain tags are provided, THE System SHALL use "global" as the thread ID
3. THE System SHALL pass the thread ID to the DeepAgents backend via the configurable.thread_id parameter
4. THE System SHALL ensure that runs with the same domain tags share the same thread and memory context


### Requirement 11

**User Story:** As a knowledge engineer, I want the enrichment subagent to link candidate Knowledge Assets to existing high-quality DKG assets, so that the knowledge graph maintains semantic connections and leverages existing trusted data.

#### Acceptance Criteria

1. THE enrichment subagent SHALL query DKG via SPARQL to find related entities before creating new assets
2. WHEN related entities exist in DKG, THE enrichment subagent SHALL include UAL references in the JSON-LD output
3. THE System SHALL use semantic relationship properties (e.g., schema:supplier, schema:partOf, dkg:derivedFrom) for linking
4. THE enrichment subagent SHALL store successful linking patterns in /memories/knowledge/<domainTag>/schema-notes.md
5. THE candidate Knowledge Assets output SHALL include a linkedAssets array containing UALs of related DKG assets

### Requirement 12

**User Story:** As a knowledge engineer, I want the validation subagent to leverage DKG tokenomics and trust signals, so that candidate assets are scored based on stake amounts and publisher reputation.

#### Acceptance Criteria

1. THE validation subagent SHALL query asset metadata to retrieve TRAC stake amounts
2. WHEN calculating confidence scores, THE System SHALL use stake amounts as trust multipliers
3. THE System SHALL assign higher confidence to assets linked to high-stake DKG assets (>50K TRAC)
4. THE validation subagent SHALL check publisher reputation via ERC-721 token ownership history
5. THE candidate Knowledge Assets output SHALL include trustSignals with confidence, linkedToHighStakeAssets, and averageLinkedStake fields

### Requirement 13

**User Story:** As an end user, I want to see the agent's planning, subagent activity, and context management in real-time, so that I understand how the knowledge mining process works and can trust the results.

#### Acceptance Criteria

1. THE Chat UI SHALL display an Agent Workspace panel showing todos, spawned subagents, filesystem files, and memory writes
2. THE Agent Workspace panel SHALL update in real-time as the agent executes tasks
3. THE System SHALL include todos, spawnedSubagents, filesystemFiles, and synthesizedReport in the knowledge-miner tool output
4. THE Chat UI SHALL provide a toggle button to show/hide the Agent Workspace panel
5. THE Agent Workspace panel SHALL automatically show when workspace data is available

### Requirement 14

**User Story:** As a knowledge engineer, I want the discovery subagent to use planning and context management tools, so that it can handle complex research tasks efficiently without overwhelming the context window.

#### Acceptance Criteria

1. THE discovery subagent SHALL have access to the write_todos tool for planning
2. THE discovery subagent SHALL have access to write_file, read_file, and edit_file tools for context management
3. THE discovery subagent SHALL have access to the task tool for spawning specialized subagents
4. WHEN search results are large, THE discovery subagent SHALL offload them to filesystem files
5. THE discovery subagent system prompt SHALL instruct it to use write_todos before starting research

### Requirement 15

**User Story:** As a knowledge engineer, I want the validation subagent to generate a synthesized report, so that I can quickly understand the validation results and reasoning without reading through all candidate assets.

#### Acceptance Criteria

1. THE validation subagent SHALL generate a synthesized report summarizing validation findings
2. THE synthesized report SHALL include counts of accepted/rejected candidates
3. THE synthesized report SHALL include average confidence scores
4. THE synthesized report SHALL include key trust signals and stake information
5. THE knowledge-miner tool output SHALL include the synthesizedReport field

### Requirement 16

**User Story:** As a system administrator, I want to configure human-in-the-loop approval for sensitive operations, so that critical actions require human review before execution.

#### Acceptance Criteria

1. THE System SHALL support interrupt_on configuration for tool approval requirements
2. THE System SHALL use a checkpointer (MemorySaver) to persist state during interrupts
3. WHEN an interrupt occurs, THE System SHALL return pending action details to the UI
4. THE Chat UI SHALL display pending actions with approve, edit, and reject options
5. THE System SHALL resume execution after receiving human decisions via Command({ resume: { decisions } })
