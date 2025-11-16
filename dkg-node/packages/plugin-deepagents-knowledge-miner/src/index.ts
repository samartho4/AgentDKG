import { defineDkgPlugin } from "@dkg/plugins";
import { z } from "zod";
import { createKnowledgeMinerAgent, defaultThreadConfig } from "./agent";

// Progress publishing - will be injected by the server
let publishProgress: ((sessionId: string, update: any) => void) | null = null;

// Export function to set the progress publisher (called by server on startup)
export function setProgressPublisher(publisher: (sessionId: string, update: any) => void) {
  publishProgress = publisher;
  console.log("✅ Progress publisher configured for DeepAgents");
}

export default defineDkgPlugin((ctx, mcp) => {
  // Register knowledge_miner_run tool
  mcp.registerTool(
    "knowledge_miner_run",
    {
      title: "Knowledge Miner - Run",
      description:
        "IMPORTANT: Use this tool when user asks to research, mine knowledge, or gather information about any topic. This starts an autonomous deep agents knowledge mining session that will search the web, analyze data, and create structured knowledge assets. Returns a thread_id for resuming.",
      inputSchema: {
        task: z
          .string()
          .describe(
            "High-level task description, e.g. 'Research TSMC supply chain risks and create KAs'",
          ),
        domain: z
          .string()
          .optional()
          .describe("Optional domain tag like 'supply-chain' or 'healthcare'"),
        sessionId: z
          .string()
          .optional()
          .describe("Optional session ID for progress tracking via SSE"),
      },
    },
    async ({ task, domain, sessionId }) => {
      try {
        const agent = createKnowledgeMinerAgent(ctx);
        const config = defaultThreadConfig();

        // Build initial user message
        let userMessage = task;
        if (domain) {
          userMessage += `\n\nDomain: ${domain}`;
        }

        // Collect progress updates as we stream
        const progressUpdates: string[] = [];
        let result: any = null;
        let stepCount = 0;
        
        progressUpdates.push('🚀 Starting knowledge mining session...\n');
        
        // Publish initial status if sessionId provided
        if (sessionId && publishProgress) {
          publishProgress(sessionId, {
            type: 'status',
            message: '🚀 Starting knowledge mining session...',
            progress: 0,
          });
        }
        
        const stream = await agent.stream(
          { messages: [{ role: "user", content: userMessage }] },
          config,
        );

        for await (const chunk of stream) {
          stepCount++;
          
          // Update result with latest state
          if (chunk && typeof chunk === 'object') {
            result = chunk;
            
            // Extract current state
            const currentState: any = Object.values(chunk)[0] || chunk;
            const messages = currentState.messages || [];
            const todos = currentState.todos || [];
            const files = currentState.files || {};
            
            // Extract current tool being executed
            const lastMsg: any = messages[messages.length - 1];
            
            if (lastMsg?.tool_calls && lastMsg.tool_calls.length > 0) {
              for (const tc of lastMsg.tool_calls) {
                const actionDesc = 
                  tc.name === 'internet_search' ? `🌐 Searching web for: "${tc.args?.query}"` :
                  tc.name === 'dkg_search_knowledge_assets' ? `🔗 Discovering knowledge: "${tc.args?.query}"` :
                  tc.name === 'dkg_link_knowledge_assets' ? `🔗 Linking knowledge assets` :
                  tc.name === 'write_file' ? `💾 Saving to: ${tc.args?.path}` :
                  tc.name === 'write_todos' ? `📋 Planning tasks` :
                  tc.name === 'task' ? `🤖 Delegating: "${tc.args?.task}"` :
                  `🔧 Using ${tc.name}`;
                
                progressUpdates.push(`Step ${stepCount}: ${actionDesc}`);
                
                // Publish tool start via SSE
                if (sessionId && publishProgress) {
                  publishProgress(sessionId, {
                    type: 'tool_start',
                    tool: tc.name,
                    message: actionDesc,
                    input: tc.args,
                    progress: Math.min(90, stepCount * 10),
                    todos: todos.map((t: any) => ({ content: t.content, status: t.status })),
                    filesCount: Object.keys(files).length,
                  });
                }
              }
            }
            
            // Check for tool results
            if (lastMsg?.role === 'tool') {
              const toolName = messages.find((m: any) => 
                m.tool_calls?.some((tc: any) => tc.id === lastMsg.tool_call_id)
              )?.tool_calls?.find((tc: any) => tc.id === lastMsg.tool_call_id)?.name;
              
              if (toolName && sessionId && publishProgress) {
                publishProgress(sessionId, {
                  type: 'tool_complete',
                  tool: toolName,
                  output: typeof lastMsg.content === 'string' 
                    ? lastMsg.content.substring(0, 500) 
                    : JSON.stringify(lastMsg.content).substring(0, 500),
                  todos: todos.map((t: any) => ({ content: t.content, status: t.status })),
                  filesCount: Object.keys(files).length,
                });
              }
            }
          }
        }
        
        if (!result) {
          throw new Error('Agent did not produce any result');
        }
        
        progressUpdates.push('\n✅ Knowledge mining session complete!');
        
        // Publish completion
        if (sessionId && publishProgress) {
          publishProgress(sessionId, {
            type: 'complete',
            message: '✅ Knowledge mining session complete!',
            progress: 100,
          });
        }

        // Extract thread_id and response
        const threadId = config.configurable.thread_id;
        const lastMessage = result.messages[result.messages.length - 1];

        // Extract DeepAgents metadata from the result state
        // DeepAgents returns state with todos (array) and files (object)
        const todos = (result as any).todos || [];
        const files = (result as any).files || {};
        
        // Extract memory files (those in /memories/ directory)
        const memoriesFiles = Object.keys(files).filter((f: string) => f.startsWith('/memories/'));
        
        // Format todos with status for display
        const todosWithStatus = todos.map((t: any) => ({
          content: t.content,
          status: t.status || 'pending'
        }));
        
        // Extract detailed tool execution info with outputs
        const toolExecutions: any[] = [];
        const toolsUsed = new Set<string>();
        const subagentsUsed = new Set<string>();
        
        // Process messages to extract tool calls and their results
        for (let i = 0; i < result.messages.length; i++) {
          const msg: any = result.messages[i];
          
          if (msg.tool_calls && msg.tool_calls.length > 0) {
            for (const tc of msg.tool_calls) {
              toolsUsed.add(tc.name);
              
              // Track subagent usage
              if (tc.name === 'task') {
                const taskName = tc.args?.task || 'unnamed-task';
                subagentsUsed.add(taskName);
              }
              
              // Find the corresponding tool result in next messages
              let toolResult: string | null = null;
              for (let j = i + 1; j < result.messages.length; j++) {
                const nextMsg: any = result.messages[j];
                if (nextMsg.role === 'tool' && nextMsg.tool_call_id === tc.id) {
                  toolResult = typeof nextMsg.content === 'string' 
                    ? nextMsg.content 
                    : JSON.stringify(nextMsg.content);
                  break;
                }
              }
              
              toolExecutions.push({
                name: tc.name,
                input: tc.args,
                output: toolResult,
                timestamp: Date.now(),
              });
            }
          }
        }
        
        // Build metadata block for DeepAgentsPanel
        const metadata = {
          threadId,
          type: "result",
          todos: todosWithStatus.length > 0 ? todosWithStatus : undefined,
          todosPreview: todosWithStatus.length > 0 
            ? `${todosWithStatus.filter((t: any) => t.status === 'completed').length}/${todosWithStatus.length} completed` 
            : undefined,
          memoriesFiles: memoriesFiles.length > 0 ? memoriesFiles : undefined,
          allFiles: Object.keys(files).length > 0 ? Object.keys(files) : undefined,
          filesContent: files,
          toolsUsed: Array.from(toolsUsed).length > 0 ? Array.from(toolsUsed) : undefined,
          toolExecutions: toolExecutions.length > 0 ? toolExecutions : undefined,
          subagentsUsed: Array.from(subagentsUsed).length > 0 ? Array.from(subagentsUsed) : undefined,
        };

        const metadataBlock = `\n\n\`\`\`deepagents-meta\n${JSON.stringify(metadata, null, 2)}\n\`\`\``;
        
        // Build progress log
        const progressLog = progressUpdates.length > 0 
          ? `\n\n<details>\n<summary>📊 Execution Log (${stepCount} steps)</summary>\n\n${progressUpdates.join('\n')}\n</details>`
          : '';

        return {
          content: [
            {
              type: "text",
              text: `${progressLog}\n\n${lastMessage.content}${metadataBlock}`,
            },
          ],
        };
      } catch (err: any) {
        // Publish error via SSE
        if (sessionId && publishProgress) {
          publishProgress(sessionId, {
            type: 'error',
            message: `Error: ${err?.message ?? String(err)}`,
            error: err?.message ?? String(err),
          });
        }
        
        return {
          content: [
            {
              type: "text",
              text: `Error running knowledge miner: ${err?.message ?? String(err)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Register knowledge_miner_resume tool
  mcp.registerTool(
    "knowledge_miner_resume",
    {
      title: "Knowledge Miner - Resume",
      description:
        "Resume a paused knowledge mining session with human decisions on pending actions.",
      inputSchema: {
        threadId: z.string().describe("Thread ID from a previous run"),
        decisions: z
          .array(
            z.object({
              type: z
                .enum(["approve", "reject", "edit"])
                .describe("Decision type for the pending action"),
              editedArgs: z
                .record(z.any())
                .optional()
                .describe("If type=edit, provide modified arguments"),
            }),
          )
          .describe("Array of decisions matching pending actions in order"),
      },
    },
    async ({ threadId, decisions }) => {
      try {
        const agent = createKnowledgeMinerAgent(ctx);
        const config = {
          configurable: {
            thread_id: threadId,
          },
        };

        // Resume with decisions
        const result = await agent.invoke({ decisions }, config);

        const lastMessage = result.messages[result.messages.length - 1];

        return {
          content: [
            {
              type: "text",
              text: `Knowledge Miner resumed.\n\n${lastMessage.content}`,
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error resuming knowledge miner: ${err?.message ?? String(err)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
});
