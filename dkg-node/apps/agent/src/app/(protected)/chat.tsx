import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Platform, KeyboardAvoidingView, ScrollView } from "react-native";
import { Image } from "expo-image";
import * as Clipboard from "expo-clipboard";
import { fetch } from "expo/fetch";
import { useSafeAreaInsets } from "react-native-safe-area-context";
//import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  parseSourceKAContent,
  SourceKA,
} from "@dkg/plugin-dkg-essentials/utils";

import { useMcpClient } from "@/client";
import useMcpToolsSession from "@/hooks/useMcpToolsSession";
import useColors from "@/hooks/useColors";
import usePlatform from "@/hooks/usePlatform";
import Page from "@/components/layout/Page";
import Container from "@/components/layout/Container";
import Header from "@/components/layout/Header";
import Chat from "@/components/Chat";
import DeepAgentsPanel from "@/components/Chat/DeepAgentsPanel";
import KnowledgeMinerPanel from "@/components/KnowledgeMinerPanel";
import ThreadHistoryPanel, {
  ThreadSummary,
} from "@/components/ThreadHistoryPanel";
import { SourceKAResolver } from "@/components/Chat/Message/SourceKAs/CollapsibleItem";
import { useAlerts } from "@/components/Alerts";

import {
  type ChatMessage,
  type ToolCall,
  type ToolCallResultContent,
  makeCompletionRequest,
  toContents,
} from "@/shared/chat";
import {
  FileDefinition,
  parseFilesFromContent,
  serializeFiles,
  uploadFiles,
} from "@/shared/files";
import { toError } from "@/shared/errors";
import useSettings from "@/hooks/useSettings";

type KnowledgeMinerSessionDebug = {
  kind: "knowledge_miner_session";
  sessionId: string;
  domain: string;
  task: string;
  todos: Array<{ content: string; status: string }>;
  workspacePaths: string[];
  subagentsUsed: { name: string; summary?: string }[];
  trustSignals?: any[];
  mainReportPath?: string;
};

const THREADS_STORAGE_KEY = "km_threads_v1";
const KM_SESSIONS_STORAGE_KEY = "km_sessions_v1";

function makeThreadSummaryFromSession(session: KnowledgeMinerSessionDebug): ThreadSummary {
  const now = Date.now();
  const title =
    session.task ||
    // fallback name – keeps list usable even if task is missing
    `Session ${session.sessionId.slice(0, 8)}`;
  return {
    id: session.sessionId,
    sessionId: session.sessionId,
    title,
    domain: session.domain,
    task: session.task,
    createdAt: now,
    updatedAt: now,
  };
}

function upsertThreadFromSession(
  threads: ThreadSummary[],
  session: KnowledgeMinerSessionDebug
): ThreadSummary[] {
  const now = Date.now();
  const idx = threads.findIndex((t) => t.sessionId === session.sessionId);
  if (idx === -1) {
    return [makeThreadSummaryFromSession(session), ...threads];
  }
  const existing = threads[idx];
  if (!existing) {
    return [makeThreadSummaryFromSession(session), ...threads];
  }
  const updated: ThreadSummary = {
    id: existing.id,
    sessionId: existing.sessionId,
    title: session.task || existing.title,
    domain: session.domain ?? existing.domain,
    task: session.task ?? existing.task,
    createdAt: existing.createdAt,
    updatedAt: now,
  };
  const next = [...threads];
  next[idx] = updated;
  next.sort((a, b) => b.updatedAt - a.updatedAt);
  return next;
}

function extractDeepAgentsMetaFromMessages(messages: ChatMessage[]): any | null {
  // Scan from newest → oldest, skipping user messages
  const reversed = [...messages].reverse();
  for (const m of reversed) {
    if (m.role === "user") continue;

    const texts: string[] = [];
    for (const c of toContents(m.content)) {
      if (c.type === "text") texts.push(c.text);
    }
    if (!texts.length) continue;

    const joined = texts.join("\n\n");
    // allow optional whitespace after the tag
    const match = joined.match(/```deepagents-meta\s*([\s\S]*?)```/);
    if (!match) continue;

    try {
      return JSON.parse((match[1] || "").trim());
    } catch {
      return null;
    }
  }
  return null;
}

export default function ChatPage() {
  const colors = useColors();
  const { isNativeMobile, isWeb, width } = usePlatform();
  const safeAreaInsets = useSafeAreaInsets();
  const { showAlert } = useAlerts();

  const settings = useSettings();
  const mcp = useMcpClient();
  const tools = useMcpToolsSession(mcp.tools);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDeepAgentsPanelOpen, setIsDeepAgentsPanelOpen] = useState(true);
  const [kmSession, setKmSession] = useState<KnowledgeMinerSessionDebug | null>(null);
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [kmSessionsById, setKmSessionsById] = useState<Record<string, KnowledgeMinerSessionDebug>>({});
  const [isThreadsCollapsed, setIsThreadsCollapsed] = useState(false);
  const [deepAgentsMeta, setDeepAgentsMeta] = useState<any | null>(null);

  const chatMessagesRef = useRef<ScrollView>(null);

  // Load thread history and sessions (SSR-safe)
  useEffect(() => {
    if (!isWeb || typeof window === "undefined") return;
    try {
      const rawThreads = window.localStorage.getItem(THREADS_STORAGE_KEY);
      const rawSessions = window.localStorage.getItem(KM_SESSIONS_STORAGE_KEY);
      if (rawThreads) {
        const parsed = JSON.parse(rawThreads) as ThreadSummary[];
        setThreads(parsed);
      }
      if (rawSessions) {
        const parsed = JSON.parse(rawSessions) as Record<string, KnowledgeMinerSessionDebug>;
        setKmSessionsById(parsed);
      }
    } catch (err) {
      console.warn("Failed to restore KM threads", err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWeb]);

  // Persist thread history and sessions
  useEffect(() => {
    if (!isWeb || typeof window === "undefined") return;
    window.localStorage.setItem(THREADS_STORAGE_KEY, JSON.stringify(threads));
    window.localStorage.setItem(KM_SESSIONS_STORAGE_KEY, JSON.stringify(kmSessionsById));
  }, [threads, kmSessionsById, isWeb]);

  const handleKnowledgeMinerResult = useCallback((debugPayload: KnowledgeMinerSessionDebug | undefined) => {
    if (!debugPayload?.sessionId) return;
    setKmSession(debugPayload);
    setKmSessionsById((prev) => ({
      ...prev,
      [debugPayload.sessionId]: debugPayload,
    }));
    setThreads((prev) => upsertThreadFromSession(prev, debugPayload));
    setActiveThreadId(debugPayload.sessionId);
  }, []);

  const handleNewKmSession = useCallback(() => {
    // "New session" from left panel:
    // clear chat + KM session but keep thread history
    setMessages([]);
    tools.reset();
    setKmSession(null);
    setActiveThreadId(null);
    setDeepAgentsMeta(null); // ✅
  }, [tools]);

  const handleSelectThread = useCallback((thread: ThreadSummary) => {
    setActiveThreadId(thread.id);
    const session = kmSessionsById[thread.sessionId];
    // If we have a stored debug session, show it again in the workspace panel
    setKmSession(session ?? null);
  }, [kmSessionsById]);

  async function callTool(tc: ToolCall & { id: string }) {
    tools.saveCallInfo(tc.id, { input: tc.args, status: "loading" });

    // Add sessionId for knowledge_miner_run to enable SSE progress
    const args = tc.name === 'knowledge_miner_run' 
      ? { ...tc.args, sessionId: tc.id }
      : tc.args;

    return mcp
      .callTool({ name: tc.name, arguments: args }, undefined, {
        timeout: 300000,
        maxTotalTimeout: 300000,
      })
      .then((result) => {
        let content = result.content as ToolCallResultContent;

        if (tc.name === "knowledge_miner_run") {
          const meta = (result as any)._meta;
          
          // ✅ store Knowledge Miner session for KnowledgeMinerPanel
          if (meta?.debugPayload && meta.debugPayload.kind === "knowledge_miner_session") {
            handleKnowledgeMinerResult(meta.debugPayload as KnowledgeMinerSessionDebug);
          }
          
          // ✅ store DeepAgents meta for DeepAgentsPanel
          if (meta?.deepAgentsMeta) {
            setDeepAgentsMeta(meta.deepAgentsMeta);
          }
        }

        tools.saveCallInfo(tc.id, {
          input: tc.args,
          status: "success",
          output: content,
        });

        return sendMessage({
          role: "tool",
          tool_call_id: tc.id,
          content,
        });
      })
      .catch((err) => {
        tools.saveCallInfo(tc.id, {
          input: tc.args,
          status: "error",
          error: err.message,
        });

        return sendMessage({
          role: "tool",
          tool_call_id: tc.id,
          content: "Error occurred while calling tool: " + err.message,
          isError: true,
        });
      });
  }

  async function cancelToolCall(tc: ToolCall & { id: string }) {
    tools.saveCallInfo(tc.id, { input: tc.args, status: "cancelled" });

    return sendMessage({
      role: "tool",
      tool_call_id: tc.id,
      content: "Tool call was cancelled by user",
    });
  }

  async function sendMessage(newMessage: ChatMessage) {
    const kaContents: any[] = [];
    if (newMessage.role === "tool") {
      const otherContents: any[] = [];
      for (const c of toContents(newMessage.content) as ToolCallResultContent) {
        const kas = parseSourceKAContent(c);
        if (kas) kaContents.push(c);
        else otherContents.push(c);
      }
      newMessage.content = otherContents;
    }

    setMessages((prevMessages) => [...prevMessages, newMessage]);

    if (!mcp.token) throw new Error("Unauthorized");

    console.log("=== SENDING TO LLM ===");
    console.log("Tools being sent:", tools.enabled.map(t => t.function.name));
    console.log("Total tools:", tools.enabled.length);
    console.log("Full tools array:", JSON.stringify(tools.enabled, null, 2));

    setIsGenerating(true);
    const completion = await makeCompletionRequest(
      {
        messages: [...messages, newMessage],
        tools: tools.enabled,
      },
      {
        fetch: (url, opts) => fetch(url.toString(), opts as any) as any,
        bearerToken: mcp.token,
      },
    );

    if (newMessage.role === "tool") {
      completion.content = toContents(completion.content);
      completion.content.push(...kaContents);
    }

    setMessages((prevMessages) => [...prevMessages, completion]);
    setIsGenerating(false);
    setTimeout(() => chatMessagesRef.current?.scrollToEnd(), 100);
  }

  async function handleDeepAgentsDecisions(decisionType: "approve" | "reject") {
    const meta = extractDeepAgentsMetaFromMessages(messages);
    if (!meta || !meta.threadId || !meta.actionRequests || !meta.actionRequests.length) {
      showAlert({
        type: "error",
        title: "Cannot resume Knowledge Miner",
        message: "No pending Deep Agents actions found to approve or reject.",
      });
      return;
    }

    const decisions = meta.actionRequests.map(() => ({ type: decisionType }));

    try {
      const result = await mcp.callTool(
        {
          name: "knowledge_miner_resume",
          arguments: {
            threadId: meta.threadId,
            decisions,
          },
        },
        undefined,
        {
          timeout: 300000,
          maxTotalTimeout: 300000,
        },
      );

      // Feed the result back into the chat as a tool message
      await sendMessage({
        role: "tool",
        tool_call_id: `knowledge-miner.resume-${Date.now()}`,
        content: result.content as ToolCallResultContent,
      });
    } catch (err: any) {
      showAlert({
        type: "error",
        title: "Failed to resume Knowledge Miner",
        message: err?.message ?? String(err),
      });
    }
  }

  const kaResolver = useCallback<SourceKAResolver>(
    async (ual) => {
      try {
        const resource = await mcp.readResource({ uri: ual });
        const content = resource.contents[0]?.text as string;
        if (!content) throw new Error("Resource not found");

        const parsedContent = JSON.parse(content);
        const resolved = {
          assertion: parsedContent.assertion,
          lastUpdated: new Date(
            parsedContent.metadata
              .at(0)
              ?.[
                "https://ontology.origintrail.io/dkg/1.0#publishTime"
              ]?.at(0)?.["@value"] ?? Date.now(),
          ).getTime(),
          txHash: parsedContent.metadata
            .at(0)
            ?.["https://ontology.origintrail.io/dkg/1.0#publishTx"]?.at(0)?.[
            "@value"
          ],
          publisher: parsedContent.metadata
            .at(0)
            ?.["https://ontology.origintrail.io/dkg/1.0#publishedBy"]?.at(0)
            ?.["@id"]?.split("/")
            .at(1),
        };

        // hotfix, KC metadata not present in KA metadata
        if (!resolved.txHash || !resolved.publisher) {
          const splitUal = ual.split("/");
          splitUal.pop();
          const kcUal = splitUal.join("/");
          const resource = await mcp.readResource({ uri: kcUal });
          const content = resource.contents[0]?.text as string;
          if (!content) {
            resolved.publisher = "unknown";
            resolved.txHash = "unknown";
            return resolved;
          }

          const parsedContent = JSON.parse(content);
          resolved.txHash =
            parsedContent.metadata
              .at(0)
              ?.["https://ontology.origintrail.io/dkg/1.0#publishTx"]?.at(0)?.[
              "@value"
            ] ?? "unknown";
          resolved.publisher =
            parsedContent.metadata
              .at(0)
              ?.["https://ontology.origintrail.io/dkg/1.0#publishedBy"]?.at(0)
              ?.["@id"]?.split("/")
              .at(1) ?? "unknown";
        }

        return resolved;
      } catch (error) {
        showAlert({
          type: "error",
          title: "Failed to resolve Knowledge Asset",
          message: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
    [mcp, showAlert],
  );

  const isLandingScreen = !messages.length && !isNativeMobile;
  console.debug("Messages:", messages);
  console.debug("Tools (enabled):", tools.enabled);
  console.debug("MCP tools available:", mcp.tools.map(t => t.name));

  return (
    <Page style={{ flex: 1, position: "relative", marginBottom: 0 }}>
      <Chat>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={20}
          style={[
            { flex: 1, position: "relative" },
            isLandingScreen
              ? { justifyContent: "flex-start" }
              : { justifyContent: "flex-end" },
          ]}
        >
          {width >= 1280 ? (
            <View style={{ flexDirection: "row", flex: 1 }}>
              {/* LEFT: Thread history */}
              <ThreadHistoryPanel
                threads={threads}
                activeThreadId={activeThreadId}
                onSelectThread={handleSelectThread}
                onNewSession={handleNewKmSession}
                isCollapsed={isThreadsCollapsed}
                onToggleCollapsed={() => setIsThreadsCollapsed((v) => !v)}
              />
              {/* CENTER: header + messages */}
              <View style={{ flex: 1 }}>
                <Container
                  style={[
                    { paddingBottom: 0 },
                    isLandingScreen && { flex: null as any },
                  ]}
                >
                  <Header handleLogout={() => mcp.disconnect()} />
                  <Chat.Messages
                    ref={chatMessagesRef}
                    style={{
                      width: "100%",
                      marginHorizontal: "auto",
                      maxWidth: 800,
                    }}
                  >
              {messages.map((m, i) => {
                if (m.role !== "user" && m.role !== "assistant") return null;

                const kas: SourceKA[] = [];
                const files: FileDefinition[] = [];
                const images: { uri: string }[] = [];
                const text: string[] = [];

                for (const c of toContents(m.content)) {
                  if (c.type === "image_url") {
                    images.push({ uri: c.image_url });
                    continue;
                  }

                  if (c.type === "text") {
                    const k = parseSourceKAContent(c as unknown as any);
                    if (k) {
                      kas.push(...k);
                      continue;
                    }

                    const f = parseFilesFromContent(c);
                    if (f.length) {
                      for (const file of f)
                        if (file.mimeType?.startsWith("image/"))
                          images.push({ uri: file.uri });
                        else files.push(file);
                      continue;
                    }

                    text.push(c.text);
                  }
                }

                const isLastMessage = i === messages.length - 1;
                const isIdle = !isGenerating && !m.tool_calls?.length;

                return (
                  <Chat.Message
                    key={i}
                    icon={m.role as "user" | "assistant"}
                    style={{ gap: 8 }}
                  >
                    {/* Source Knowledge Assets */}
                    <Chat.Message.SourceKAs kas={kas} resolver={kaResolver} />

                    {/* Images */}
                    {images.map((image, i) => (
                      <Chat.Message.Content.Image
                        key={i}
                        url={image.uri}
                        authToken={mcp.token}
                      />
                    ))}

                    {/* Files */}
                    {files.map((file, i) => (
                      <Chat.Message.Content.File key={i} file={file} />
                    ))}

                    {/* Text (markdown) */}
                    {text.map((c, i) => (
                      <Chat.Message.Content.Text
                        key={i}
                        text={c.replaceAll(/<think>.*?<\/think>/gs, "")}
                      />
                    ))}

                    {/* Tool calls */}
                    {m.tool_calls?.map((_tc, i) => {
                      const tcId = _tc.id || i.toString();
                      const tc = {
                        ..._tc,
                        id: tcId,
                        info: tools.getCallInfo(tcId),
                      };
                      const toolInfo = mcp.getToolInfo(tc.name);

                      const title = toolInfo
                        ? `${toolInfo.name} - ${mcp.name} (MCP Server)`
                        : tc.name;
                      const description = toolInfo?.description;
                      const autoconfirm =
                        (settings.autoApproveMcpTools ||
                          tools.isAllowedForSession(tc.name)) &&
                        !tc.info;

                      return (
                        <Chat.Message.ToolCall
                          key={tc.id}
                          title={title}
                          description={description}
                          status={tc.info?.status ?? "init"}
                          input={tc.info?.input ?? _tc.args}
                          output={tc.info?.output ?? tc.info?.error}
                          autoconfirm={autoconfirm}
                          onConfirm={(allowForSession) => {
                            callTool(tc);
                            if (allowForSession) tools.allowForSession(tc.name);
                          }}
                          onCancel={() => cancelToolCall(tc)}
                        />
                      );
                    })}

                    {/* Actions at the bottom */}
                    {m.role === "assistant" && isLastMessage && isIdle && (
                      <Chat.Message.Actions
                        style={{ marginVertical: 16 }}
                        onCopyAnswer={() => {
                          Clipboard.setStringAsync(text.join("\n").trim());
                        }}
                        onStartAgain={handleNewKmSession}
                      />
                    )}
                  </Chat.Message>
                );
                      })}
                      {isGenerating && <Chat.Thinking />}
                    </Chat.Messages>
                  </Container>
                </View>
                {/* RIGHT: workspace (Knowledge Miner + subagents) */}
                <View style={{ width: 420 }}>
                  <Container style={{ paddingBottom: 0 }}>
                    {kmSession && <KnowledgeMinerPanel session={kmSession} />}
                    <DeepAgentsPanel
                      messages={messages}
                      isOpen={isDeepAgentsPanelOpen}
                      onToggle={() => setIsDeepAgentsPanelOpen((v) => !v)}
                      onDecideInterrupt={handleDeepAgentsDecisions}
                      initialMeta={deepAgentsMeta} // ✅ new
                    />
                  </Container>
                </View>
              </View>
            ) : (
            // Narrow layout: keep the old single-column structure, no history panel
            <Container
              style={[
                { paddingBottom: 0 },
                isLandingScreen && { flex: null as any },
              ]}
            >
              <Header handleLogout={() => mcp.disconnect()} />
              {/* Knowledge Miner Workspace panel */}
              {kmSession && <KnowledgeMinerPanel session={kmSession} />}
              {/* Deep Agents knowledge-mining workspace panel */}
              <DeepAgentsPanel
                messages={messages}
                isOpen={isDeepAgentsPanelOpen}
                onToggle={() => setIsDeepAgentsPanelOpen((v) => !v)}
                onDecideInterrupt={handleDeepAgentsDecisions}
                initialMeta={deepAgentsMeta} // ✅ new
              />
              <Chat.Messages
                ref={chatMessagesRef}
                style={[
                  {
                    width: "100%",
                    marginHorizontal: "auto",
                    maxWidth: 800,
                  },
                  width >= 800 + 48 * 2 + 20 * 2 && {
                    maxWidth: 800 + 48 * 2,
                    paddingRight: 48,
                  },
                ]}
              >
                {messages.map((m, i) => {
                  if (m.role !== "user" && m.role !== "assistant") return null;

                  const kas: SourceKA[] = [];
                  const files: FileDefinition[] = [];
                  const images: { uri: string }[] = [];
                  const text: string[] = [];

                  for (const c of toContents(m.content)) {
                    if (c.type === "image_url") {
                      images.push({ uri: c.image_url });
                      continue;
                    }

                    if (c.type === "text") {
                      const k = parseSourceKAContent(c as unknown as any);
                      if (k) {
                        kas.push(...k);
                        continue;
                      }

                      const f = parseFilesFromContent(c);
                      if (f.length) {
                        for (const file of f)
                          if (file.mimeType?.startsWith("image/"))
                            images.push({ uri: file.uri });
                          else files.push(file);
                        continue;
                      }

                      text.push(c.text);
                    }
                  }

                  const isLastMessage = i === messages.length - 1;
                  const isIdle = !isGenerating && !m.tool_calls?.length;

                  return (
                    <Chat.Message
                      key={i}
                      icon={m.role as "user" | "assistant"}
                      style={{ gap: 8 }}
                    >
                      {/* Source Knowledge Assets */}
                      <Chat.Message.SourceKAs kas={kas} resolver={kaResolver} />

                      {/* Images */}
                      {images.map((image, i) => (
                        <Chat.Message.Content.Image
                          key={i}
                          url={image.uri}
                          authToken={mcp.token}
                        />
                      ))}

                      {/* Files */}
                      {files.map((file, i) => (
                        <Chat.Message.Content.File key={i} file={file} />
                      ))}

                      {/* Text (markdown) */}
                      {text.map((c, i) => (
                        <Chat.Message.Content.Text
                          key={i}
                          text={c.replaceAll(/<think>.*?<\/think>/gs, "")}
                        />
                      ))}

                      {/* Tool calls */}
                      {m.tool_calls?.map((_tc, i) => {
                        const tcId = _tc.id || i.toString();
                        const tc = {
                          ..._tc,
                          id: tcId,
                          info: tools.getCallInfo(tcId),
                        };
                        const toolInfo = mcp.getToolInfo(tc.name);

                        const title = toolInfo
                          ? `${toolInfo.name} - ${mcp.name} (MCP Server)`
                          : tc.name;
                        const description = toolInfo?.description;
                        const autoconfirm =
                          (settings.autoApproveMcpTools ||
                            tools.isAllowedForSession(tc.name)) &&
                          !tc.info;

                        return (
                          <Chat.Message.ToolCall
                            key={tc.id}
                            title={title}
                            description={description}
                            status={tc.info?.status ?? "init"}
                            input={tc.info?.input ?? _tc.args}
                            output={tc.info?.output ?? tc.info?.error}
                            autoconfirm={autoconfirm}
                            onConfirm={(allowForSession) => {
                              callTool(tc);
                              if (allowForSession) tools.allowForSession(tc.name);
                            }}
                            onCancel={() => cancelToolCall(tc)}
                          />
                        );
                      })}

                      {/* Actions at the bottom */}
                      {m.role === "assistant" && isLastMessage && isIdle && (
                        <Chat.Message.Actions
                          style={{ marginVertical: 16 }}
                          onCopyAnswer={() => {
                            Clipboard.setStringAsync(text.join("\n").trim());
                          }}
                          onStartAgain={handleNewKmSession}
                        />
                      )}
                    </Chat.Message>
                  );
                })}
                {isGenerating && <Chat.Thinking />}
              </Chat.Messages>
            </Container>
          )}

          <View
            style={[
              { width: "100%" },
              isLandingScreen && { marginTop: 60 },
              isNativeMobile && {
                backgroundColor: colors.backgroundFlat,
                paddingBottom: safeAreaInsets.bottom,
                height: 2 * 56 + safeAreaInsets.bottom + 20,
              },
            ]}
          >
            <Container
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {isLandingScreen && (
                <Image
                  source={require("@/assets/logo.svg")}
                  style={{ width: 100, height: 100, marginBottom: 24 }}
                  testID="app-logo"
                />
              )}
              <Chat.Input
                onSendMessage={sendMessage}
                onUploadFiles={(assets) =>
                  uploadFiles(
                    new URL(process.env.EXPO_PUBLIC_MCP_URL + "/blob"),
                    assets,
                    {
                      fieldName: "file",
                      uploadType: 1,
                      headers: { Authorization: `Bearer ${mcp.token}` },
                    },
                  ).then(({ successful, failed }) => {
                    if (failed.length) {
                      console.debug("Failed uploads:", failed);
                      showAlert({
                        type: "error",
                        title: "Upload error",
                        message: "Some uploads have failed!",
                        timeout: 5000,
                      });
                    }

                    return successful.map((data) => ({
                      ...data,
                      uri: new URL(
                        process.env.EXPO_PUBLIC_MCP_URL + "/blob/" + data.id,
                      ).toString(),
                    }));
                  })
                }
                onFileRemoved={(f) => {
                  fetch(
                    new URL(
                      process.env.EXPO_PUBLIC_MCP_URL + "/blob/" + f.id,
                    ).toString(),
                    {
                      method: "DELETE",
                      headers: { Authorization: `Bearer ${mcp.token}` },
                    },
                  ).catch((error) => {
                    console.debug("File removal error:", error);
                    showAlert({
                      type: "error",
                      title: "File removal error",
                      message: toError(error).message,
                      timeout: 5000,
                    });
                  });
                }}
                onUploadError={(error) => {
                  console.debug("Upload error:", error);
                  showAlert({
                    type: "error",
                    title: "Upload error",
                    message: error.message,
                    timeout: 5000,
                  });
                }}
                onAttachFiles={serializeFiles}
                authToken={mcp.token}
                tools={{
                  [mcp.name]: mcp.tools.map((t) => ({
                    name: t.name,
                    description: t.description,
                    enabled: tools.isEnabled(t.name),
                  })),
                }}
                onToolTick={(_, tool, enabled) => {
                  tools.toggle(tool, enabled);
                }}
                onToolServerTick={(_, enabled) => {
                  tools.toggleAll(enabled);
                }}
                disabled={isGenerating}
                style={[{ maxWidth: 800 }, isWeb && { pointerEvents: "auto" }]}
              />
            </Container>
          </View>
        </KeyboardAvoidingView>
      </Chat>
    </Page>
  );
}
