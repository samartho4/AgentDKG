import { defineDkgPlugin } from "@dkg/plugins";
import { z } from "zod";
import {
  createKnowledgeMinerAgent,
  defaultThreadConfig,
} from "./agent";

// Progress publishing – injected by the server (SSE)
let publishProgress: ((sessionId: string, update: any) => void) | null = null;

// Export function to set the progress publisher (called by server on startup)
export function setProgressPublisher(
  publisher: (sessionId: string, update: any) => void,
) {
  publishProgress = publisher;
  console.log("✅ Progress publisher configured for DeepAgents knowledge miner");
}

export default defineDkgPlugin((ctx, mcp) => {
  // ---------------------------------------------------------------------------
  // knowledge_miner_run
  // ---------------------------------------------------------------------------
  mcp.registerTool(
    "knowledge_miner_run",
    {
      title: "Knowledge Miner - Run",
      description:
        "Start an autonomous DeepAgents knowledge mining session that searches the web, uses DKG tools, and writes structured knowledge into /memories. Returns a thread_id and debug info.",
      inputSchema: {
        task: z
          .string()
          .describe(
            "High-level task description, e.g. 'Search web for blockchain supply chain, find related KAs, link and score them'.",
          ),
        domain: z
          .string()
          .optional()
          .describe(
            "Optional domain tag like 'supply-chain', 'healthcare', etc.",
          ),
        sessionId: z
          .string()
          .optional()
          .describe(
            "Optional session ID for progress tracking via SSE (/progress?sessionId=...)",
          ),
      },
    },
    async ({ task, domain, sessionId }) => {
      try {
        console.log("📝 Creating knowledge miner agent...");
        console.log("📋 Received parameters:", { task: task.substring(0, 100), domain, sessionId });
        console.log("🔌 publishProgress available?", !!publishProgress);
        const agent = createKnowledgeMinerAgent(ctx);
        console.log("✅ Agent created successfully");

        console.log("⚙️  Creating DeepAgents thread config...");
        const config = defaultThreadConfig();
        console.log("✅ Config created:", config);

        // Build initial user message
        let userMessage = task;
        if (domain) {
          userMessage += `\n\nDomain: ${domain}`;
        }

        const progressUpdates: string[] = [];
        let stepCount = 0;
        progressUpdates.push("🚀 Starting knowledge mining session...\n");

        // Initial SSE status
        if (sessionId && publishProgress) {
          publishProgress(sessionId, {
            type: "status",
            message: "🚀 Starting knowledge mining session...",
            progress: 0,
          });
        }

        console.log("🔍 Invoking agent with task:", userMessage);

        let result: any;
        try {
          result = await agent.invoke(
            { messages: [{ role: "user", content: userMessage }] },
            config,
          );
          console.log("✅ Agent invocation completed");
          try {
            console.log(
              "📦 Result structure (truncated):",
              JSON.stringify(result, null, 2).substring(0, 500),
            );
          } catch {
            // ignore stringify errors
          }
        } catch (err: any) {
          console.error("❌ Agent invocation error:", err);
          
          // Handle specific error types gracefully
          if (err?.lc_error_code === "GRAPH_RECURSION_LIMIT") {
            const errorMsg = "Knowledge miner hit its step limit. Try again with a narrower task, or an admin should increase recursionLimit.";
            
            if (sessionId && publishProgress) {
              publishProgress(sessionId, {
                type: "error",
                message: errorMsg,
                error: errorMsg,
              });
            }
            
            return {
              content: [
                {
                  type: "text",
                  text: `⚠️ ${errorMsg}\n\nTechnical details: ${err.message}`,
                },
              ],
            };
          }
          
          // Re-throw other errors
          throw err;
        }

        console.log("🎯 Result received, processing...");

        // We treat the final DeepAgents state as a single "chunk"
        for await (const chunk of [result]) {
          stepCount++;

          if (chunk && typeof chunk === "object") {
            // DeepAgents state is usually directly in the result
            const currentState: any = Object.values(chunk)[0] || chunk;
            const messages = currentState.messages || [];
            const todos = currentState.todos || [];
            const files = currentState.files || {};

            const lastMsg: any =
              messages.length > 0 ? messages[messages.length - 1] : null;

            if (lastMsg?.tool_calls && lastMsg.tool_calls.length > 0) {
              for (const tc of lastMsg.tool_calls) {
                const actionDesc =
                  tc.name === "internet_search"
                    ? `🌐 Searching web for: "${tc.args?.query}"`
                    : tc.name === "dkg_get"
                    ? `🔎 Fetching KA from DKG: "${tc.args?.ual}"`
                    : tc.name === "dkg_create"
                    ? "� Publigshing Knowledge Asset to DKG"
                    : tc.name === "x402_trust_score"
                    ? `🧮 Computing x402 trust score for: "${tc.args?.ual}"`
                    : tc.name === "write_file"
                    ? `💾 Saving to: ${tc.args?.path}`
                    : tc.name === "write_todos"
                    ? "📋 Planning tasks"
                    : tc.name === "task"
                    ? `🤖 Delegating subagent task: "${tc.args?.task}"`
                    : `🔧 Using ${tc.name}`;

                progressUpdates.push(`Step ${stepCount}: ${actionDesc}`);

                if (sessionId && publishProgress) {
                  const todosSlim = todos.map((t: any) => ({
                    content: t.content,
                    status: t.status,
                  }));

                  publishProgress(sessionId, {
                    type: "tool_start",
                    tool: tc.name,
                    message: actionDesc,
                    input: tc.args,
                    progress: Math.min(90, stepCount * 10),
                    todos: todosSlim,
                    filesCount: Object.keys(files).length,
                  });
                }
              }
            }

            // Tool completion
            if (lastMsg?.role === "tool") {
              const toolName = messages
                .find((m: any) =>
                  m.tool_calls?.some(
                    (tc: any) => tc.id === lastMsg.tool_call_id,
                  ),
                )
                ?.tool_calls?.find(
                  (tc: any) => tc.id === lastMsg.tool_call_id,
                )?.name;

              if (toolName && sessionId && publishProgress) {
                const todosSlim = todos.map((t: any) => ({
                  content: t.content,
                  status: t.status,
                }));

                publishProgress(sessionId, {
                  type: "tool_complete",
                  tool: toolName,
                  output:
                    typeof lastMsg.content === "string"
                      ? lastMsg.content.substring(0, 500)
                      : JSON.stringify(lastMsg.content).substring(0, 500),
                  todos: todosSlim,
                  filesCount: Object.keys(files).length,
                });
              }
            }
          }
        }

        if (!result) {
          throw new Error("Agent did not produce any result");
        }

        progressUpdates.push("\n✅ Knowledge mining session complete!");

        if (sessionId && publishProgress) {
          publishProgress(sessionId, {
            type: "complete",
            message: "✅ Knowledge mining session complete!",
            progress: 100,
          });
        }

        // Extract DeepAgents state
        const threadId = config.configurable.thread_id;
        const resultMessages = result.messages || [];
        const lastMessage =
          resultMessages.length > 0
            ? resultMessages[resultMessages.length - 1]
            : { content: "No response generated" };

        const todos = (result as any).todos || [];
        const files = (result as any).files || {};

        const memoriesFiles = Object.keys(files).filter((f) =>
          f.startsWith("/memories/"),
        );

        const todosWithStatus = todos.map((t: any) => ({
          content: t.content,
          status: t.status || "pending",
        }));

        // Extract tool usage & subagents
        const toolExecutions: any[] = [];
        const toolsUsed = new Set<string>();
        const subagentsUsed = new Set<string>();

        for (let i = 0; i < resultMessages.length; i++) {
          const msg: any = resultMessages[i];

          if (msg.tool_calls && msg.tool_calls.length > 0) {
            for (const tc of msg.tool_calls) {
              toolsUsed.add(tc.name);

              // ✅ Better subagent detection: handle both string and object args
              if (tc.name === "task") {
                const rawArgs = tc.args;
                console.log("🔍 TASK tool args:", JSON.stringify(rawArgs, null, 2));
                let subagentName: string | null = null;

                if (typeof rawArgs === "string") {
                  // e.g. "knowledge_enrichment"
                  subagentName = rawArgs;
                } else if (rawArgs && typeof rawArgs === "object") {
                  subagentName =
                    // *** THIS IS WHAT WAS MISSING ***
                    (rawArgs as any).subagent_type ||
                    (rawArgs as any).agent_name ||
                    (rawArgs as any).agent ||
                    (rawArgs as any).subagent ||
                    (rawArgs as any).name ||
                    (typeof (rawArgs as any).task === "string"
                      ? (rawArgs as any).task.slice(0, 60)
                      : null);
                }

                if (!subagentName) {
                  subagentName = "unnamed-task";
                }
                subagentsUsed.add(subagentName);
              }

              let toolResult: string | null = null;
              for (let j = i + 1; j < resultMessages.length; j++) {
                const nextMsg: any = resultMessages[j];
                if (
                  nextMsg.role === "tool" &&
                  nextMsg.tool_call_id === tc.id
                ) {
                  toolResult =
                    typeof nextMsg.content === "string"
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

        // Extract trust signals from x402_trust_score outputs
        const trustSignals: any[] = [];
        for (const exec of toolExecutions) {
          if (exec.name === "x402_trust_score" && exec.output) {
            try {
              const parsed = JSON.parse(exec.output);
              if (parsed && parsed.kind === "x402_trust_signal") {
                trustSignals.push(parsed);
              }
            } catch {
              // ignore parse errors; leave exec.output in workflow view only
            }
          }
        }

        // Flatten files into strings for proper display
        const rawFiles = files || {};
        const flatFiles: Record<string, string> = {};
        for (const [path, value] of Object.entries(rawFiles)) {
          if (typeof value === "string") {
            flatFiles[path] = value;
          } else if (value && typeof value === "object" && "content" in value) {
            // @ts-ignore
            flatFiles[path] = String((value as any).content ?? "");
          }
        }

        // Metadata for DeepAgentsPanel (right workspace)
        const metaForPanel = {
          threadId,
          type: "result",
          todos: todosWithStatus.length > 0 ? todosWithStatus : undefined,
          todosPreview:
            todosWithStatus.length > 0
              ? `${todosWithStatus.filter((t: any) => t.status === "completed").length}/${todosWithStatus.length} completed`
              : undefined,
          memoriesFiles:
            memoriesFiles.length > 0 ? memoriesFiles : undefined,
          allFiles:
            Object.keys(flatFiles).length > 0 ? Object.keys(flatFiles) : undefined,
          filesContent: flatFiles,
          toolsUsed:
            Array.from(toolsUsed).length > 0
              ? Array.from(toolsUsed)
              : undefined,
          toolExecutions:
            toolExecutions.length > 0 ? toolExecutions : undefined,
          subagentsUsed:
            Array.from(subagentsUsed).length > 0
              ? Array.from(subagentsUsed)
              : undefined,
          trustSignals:
            trustSignals.length > 0 ? trustSignals : undefined,
        };

        // Progress log for human-readable trace
        const progressLog =
          progressUpdates.length > 0
            ? `\n\n<details>\n<summary>📊 Execution Log (${stepCount} steps)</summary>\n\n${progressUpdates.join(
                "\n",
              )}\n</details>`
            : "";

        const taskDomain = domain || "general";

        // Prioritize community_note.md as the main report
        const mainReportPath =
          memoriesFiles.find((p) => p.endsWith("community_note.md")) ??
          memoriesFiles[0];

        // Debug payload for ChatPage → KnowledgeMinerPanel (right side)
        const debugPayload = {
          kind: "knowledge_miner_session" as const,
          sessionId: threadId,
          domain: taskDomain,
          task,
          todos: todosWithStatus,
          workspacePaths: Object.keys(flatFiles),
          subagentsUsed: Array.from(subagentsUsed).map((name) => ({ name })),
          trustSignals,
          mainReportPath: mainReportPath,
        };

        const lastMessageText =
          typeof lastMessage.content === "string"
            ? lastMessage.content
            : JSON.stringify(lastMessage.content, null, 2);

        // DeepAgents meta block for DeepAgentsPanel (parsed by ```deepagents-meta ... ```)
        const deepAgentsMetaBlock =
          "```deepagents-meta\n" +
          JSON.stringify(metaForPanel, null, 2) +
          "\n```";

        return {
          content: [
            {
              type: "text",
              text:
                progressLog +
                "\n\n" +
                lastMessageText +
                "\n\n" +
                deepAgentsMetaBlock,
            },
          ] as any,
          _meta: {
            debugPayload,
            deepAgentsMeta: metaForPanel, // ✅ new
          },
        };
      } catch (err: any) {
        console.error("❌ Error in knowledge_miner_run:", err);

        if (sessionId && publishProgress) {
          publishProgress(sessionId, {
            type: "error",
            message: `Error: ${err?.message ?? String(err)}`,
            error: err?.message ?? String(err),
          });
        }

        return {
          content: [
            {
              type: "text",
              text: `Error running knowledge miner: ${
                err?.message ?? String(err)
              }`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // ---------------------------------------------------------------------------
  // knowledge_miner_resume
  // ---------------------------------------------------------------------------
  mcp.registerTool(
    "knowledge_miner_resume",
    {
      title: "Knowledge Miner - Resume",
      description:
        "Resume a paused knowledge mining session with human decisions on pending actions (interrupts).",
      inputSchema: {
        threadId: z.string().describe("Thread ID from a previous run."),
        decisions: z
          .array(
            z.object({
              type: z
                .enum(["approve", "reject", "edit"])
                .describe("Decision type for the pending action."),
              editedArgs: z
                .record(z.any())
                .optional()
                .describe(
                  "If type=edit, provide modified arguments for the action.",
                ),
            }),
          )
          .describe("Array of decisions matching pending actions in order."),
      },
    },
    async ({ threadId, decisions }) => {
      try {
        console.log("🔁 Resuming knowledge miner thread:", threadId);
        const agent = createKnowledgeMinerAgent(ctx);
        const config = {
          configurable: {
            thread_id: threadId,
          },
        };

        const result: any = await agent.invoke({ decisions }, config);

        const resultMessages = result.messages || [];
        const lastMessage =
          resultMessages.length > 0
            ? resultMessages[resultMessages.length - 1]
            : { content: "No response generated" };

        const lastMessageText =
          typeof lastMessage.content === "string"
            ? lastMessage.content
            : JSON.stringify(lastMessage.content, null, 2);

        return {
          content: [
            {
              type: "text",
              text: `Knowledge Miner resumed.\n\n${lastMessageText}`,
            },
          ],
        };
      } catch (err: any) {
        console.error("❌ Error in knowledge_miner_resume:", err);

        return {
          content: [
            {
              type: "text",
              text: `Error resuming knowledge miner: ${
                err?.message ?? String(err)
              }`,
            },
          ],
          isError: true,
        };
      }
    },
  );
});
