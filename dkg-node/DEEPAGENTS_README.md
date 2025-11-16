# DeepAgents Knowledge Miner

Autonomous knowledge mining agent with real-time progress streaming for the DKG Agent.

## Documentation

📚 **[Complete Implementation Guide](./DEEPAGENTS_COMPLETE_GUIDE.md)**
- Architecture overview
- Features and capabilities
- Implementation details
- Configuration
- API reference
- Troubleshooting

🧪 **[Testing Guide](./DEEPAGENTS_TESTING.md)**
- Quick start
- Test cases
- Interactive testing
- Debugging
- Validation checklist

## Quick Start

1. **Start services:**
   ```bash
   cd dkg-node/apps/agent
   npm run dev:server  # Terminal 1
   npm run dev:app     # Terminal 2
   ```

2. **Open app:** http://localhost:8081/chat

3. **Test query:**
   ```
   Run a knowledge mining session to research TSMC supply chain
   ```

4. **Watch real-time progress** in the DeepAgentsPanel!

## Features

- 🌐 **Web Search** via Tavily API
- 🔗 **DKG Discovery** of existing knowledge
- 💾 **Memory Storage** for research findings
- 📋 **Task Planning** with todos
- 🤖 **Subagent Delegation** for complex tasks
- ⚡ **Real-Time Progress** via Server-Sent Events
- 🔍 **Interactive UI** with expandable details

## Key Files

```
packages/plugin-deepagents-knowledge-miner/  # Plugin implementation
apps/agent/src/app/progress+api.ts           # SSE endpoint
apps/agent/src/shared/progress.ts            # Progress publisher
apps/agent/src/components/Chat/DeepAgentsPanel.tsx  # UI panel
```

## Requirements

- Node.js 18+
- Tavily API key (for web search)
- Anthropic/OpenAI/Google API key (for LLM)

## Support

See the [Complete Guide](./DEEPAGENTS_COMPLETE_GUIDE.md) for detailed documentation and troubleshooting.
