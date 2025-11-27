import { useMemo, useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking, Platform } from "react-native";

import useColors from "@/hooks/useColors";
import Button from "@/components/Button";
import type { ChatMessage } from "@/shared/chat";
import { toContents } from "@/shared/chat";

type Props = {
  messages: ChatMessage[];
  isOpen: boolean;
  onToggle: () => void;
  onDecideInterrupt?: (decision: "approve" | "reject") => void;
  initialMeta?: DeepAgentsMeta | null; // ✅ new
};

type Todo = {
  content: string;
  status: "pending" | "in_progress" | "completed";
};

type ToolExecution = {
  name: string;
  input: any;
  output: string | null;
  timestamp: number;
};

type DeepAgentsMeta = {
  threadId?: string;
  type?: "result" | "interrupt" | string;
  todos?: Todo[];
  todosPreview?: string;
  memoriesFiles?: string[];
  allFiles?: string[];
  filesContent?: Record<string, string>;
  toolsUsed?: string[];
  toolExecutions?: ToolExecution[];
  subagentsUsed?: string[];
  trustSignals?: any[];
  // present only when type === "interrupt"
  actionRequests?: any[];
  reviewConfigs?: any[];
};

function extractDeepAgentsMeta(messages: ChatMessage[]): DeepAgentsMeta | null {
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
      const json = JSON.parse((match[1] || "").trim());
      return json as DeepAgentsMeta;
    } catch (err) {
      console.error("Failed to parse deepagents-meta JSON:", err);
      return null;
    }
  }
  return null;
}

export default function DeepAgentsPanel({ messages, isOpen, onToggle, onDecideInterrupt, initialMeta }: Props) {
  const colors = useColors();
  const metaFromMessages = useMemo(() => extractDeepAgentsMeta(messages), [messages]);
  const meta = initialMeta || metaFromMessages;
  const [expandedTool, setExpandedTool] = useState<number | null>(null);
  const [expandedFile, setExpandedFile] = useState<string | null>(null);
  
  // Real-time progress state
  const [liveProgress, setLiveProgress] = useState<any[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<string>('');

  // Subscribe to SSE progress updates
  useEffect(() => {
    if (!meta?.threadId) return;
    
    const sessionId = meta?.threadId;
    const eventSource = new EventSource(
      `${process.env.EXPO_PUBLIC_APP_URL}/progress?sessionId=${sessionId}`
    );

    setIsStreaming(true);

    eventSource.onmessage = (event) => {
      try {
        const update = JSON.parse(event.data);
        
        if (update.type === 'connected') {
          console.log('SSE connected for session:', sessionId);
          return;
        }
        
        // Update live progress
        setLiveProgress(prev => [...prev, update]);
        
        // Update current status
        if (update.message) {
          setCurrentStatus(update.message);
        }
        
        // Stop streaming on completion or error
        if (update.type === 'complete' || update.type === 'error') {
          setIsStreaming(false);
          eventSource.close();
        }
      } catch (err) {
        console.error('Error parsing SSE message:', err);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      setIsStreaming(false);
      eventSource.close();
    };

    return () => {
      eventSource.close();
      setIsStreaming(false);
    };
  }, [meta?.threadId]);

  if (!meta && liveProgress.length === 0) return null;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.card, borderColor: colors.card2 },
      ]}
    >
      <TouchableOpacity onPress={onToggle} style={styles.headerRow}>
        <Text style={[styles.title, { color: colors.cardText }]}>
          Knowledge Mining Workspace
        </Text>
        <Text style={{ color: colors.secondary }}>{isOpen ? "Hide" : "Show"}</Text>
      </TouchableOpacity>

      {isOpen && (
        <>
          {meta?.threadId && (
            <Text style={[styles.threadId, { color: colors.secondary }]}>
              thread_id: {meta?.threadId}
            </Text>
          )}

          <View style={styles.row}>
            <Text style={[styles.label, { color: colors.placeholder }]}>Status:</Text>
            <Text style={{ color: colors.text }}>
              {isStreaming ? (
                <Text style={{ color: colors.primary }}>
                  🔄 {currentStatus || 'Processing...'}
                </Text>
              ) : meta?.type === "interrupt" ? (
                "Awaiting human decisions (human-in-the-loop)"
              ) : (
                "Completed"
              )}
            </Text>
          </View>
          
          {/* Live Progress Indicator */}
          {isStreaming && liveProgress.length > 0 && (
            <View style={[styles.section, { backgroundColor: colors.card2, padding: 8, borderRadius: 6 }]}>
              <Text style={[styles.sectionTitle, { color: colors.primary }]}>
                ⚡ Live Progress
              </Text>
              <ScrollView style={{ maxHeight: 150 }}>
                {liveProgress.slice(-5).map((update, idx) => (
                  <Text key={idx} style={{ color: colors.text, fontSize: 11, marginBottom: 2 }}>
                    {update.message || `${update.tool} - ${update.type}`}
                  </Text>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Todos Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.placeholder }]}>
              📋 To-dos {meta?.todosPreview && `(${meta?.todosPreview})`}
            </Text>
            {meta?.todos && meta?.todos.length > 0 ? (
              <View style={{ marginTop: 4 }}>
                {meta?.todos.map((todo, idx) => (
                  <View key={idx} style={styles.todoItem}>
                    <Text style={{ color: colors.text, fontSize: 12 }}>
                      {todo.status === "completed" ? "✅" : 
                       todo.status === "in_progress" ? "🔄" : "⏳"}{" "}
                      {todo.content}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={{ color: colors.secondary, fontSize: 12, marginTop: 4 }}>
                No todos created yet
              </Text>
            )}
          </View>

          {/* Memories Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.placeholder }]}>
              🧠 Memories & Files
            </Text>
            {meta?.memoriesFiles && meta?.memoriesFiles.length > 0 ? (
              <View style={{ marginTop: 4 }}>
                {meta?.memoriesFiles.map((filePath) => {
                  const isExpanded = expandedFile === filePath;
                  const fileContent = meta?.filesContent?.[filePath];
                  
                  return (
                    <View key={filePath} style={{ marginBottom: 4 }}>
                      <TouchableOpacity
                        onPress={() => setExpandedFile(isExpanded ? null : filePath)}
                        style={{ flexDirection: 'row', alignItems: 'center' }}
                      >
                        <Text style={{ color: colors.text, fontSize: 12, flex: 1 }}>
                          📄 {filePath}
                        </Text>
                        {fileContent && (
                          <Text style={{ color: colors.secondary, fontSize: 11 }}>
                            {isExpanded ? '▼' : '▶'}
                          </Text>
                        )}
                      </TouchableOpacity>
                      
                      {isExpanded && fileContent && (
                        <View style={[styles.fileContent, { backgroundColor: colors.background }]}>
                          <ScrollView style={{ maxHeight: 200 }}>
                            <Text style={{ color: colors.text, fontSize: 11, fontFamily: 'monospace' }}>
                              {fileContent.length > 2000 
                                ? fileContent.substring(0, 2000) + '...\n[truncated]'
                                : fileContent}
                            </Text>
                          </ScrollView>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={{ color: colors.secondary, fontSize: 12, marginTop: 4 }}>
                No memory files created yet
              </Text>
            )}
            {meta?.allFiles && meta?.allFiles.length > (meta?.memoriesFiles?.length || 0) && (
              <Text style={{ color: colors.secondary, fontSize: 11, marginTop: 4 }}>
                + {meta?.allFiles.length - (meta?.memoriesFiles?.length || 0)} other files
              </Text>
            )}
          </View>

          {/* Knowledge Mining Workflow */}
          {meta?.toolExecutions && meta?.toolExecutions.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.placeholder }]}>
                🔍 Knowledge Mining Workflow
              </Text>
              <View style={{ marginTop: 8 }}>
                {meta?.toolExecutions.map((exec, idx) => {
                  const isExpanded = expandedTool === idx;
                  const icon = 
                    exec.name === 'internet_search' ? '🌐' :
                    exec.name === 'dkg_search_knowledge_assets' ? '🔗' :
                    exec.name === 'dkg_link_knowledge_assets' ? '🔗' :
                    exec.name === 'write_file' ? '💾' :
                    exec.name === 'write_todos' ? '📋' :
                    exec.name === 'task' ? '🤖' :
                    '🔧';
                  
                  const label =
                    exec.name === 'internet_search' ? 'Web Search' :
                    exec.name === 'dkg_search_knowledge_assets' ? 'DKG Discovery' :
                    exec.name === 'dkg_link_knowledge_assets' ? 'Knowledge Linking' :
                    exec.name === 'write_file' ? 'Memory Storage' :
                    exec.name === 'write_todos' ? 'Planning' :
                    exec.name === 'task' ? 'Subagent Delegation' :
                    exec.name;

                  return (
                    <View key={idx} style={{ marginBottom: 8 }}>
                      <TouchableOpacity
                        onPress={() => setExpandedTool(isExpanded ? null : idx)}
                        style={[styles.toolExecution, { backgroundColor: colors.card2 }]}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                          <Text style={{ fontSize: 16, marginRight: 8 }}>{icon}</Text>
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: colors.text, fontSize: 12, fontWeight: '600' }}>
                              {label}
                            </Text>
                            {exec.input && (
                              <Text style={{ color: colors.secondary, fontSize: 10, marginTop: 2 }} numberOfLines={1}>
                                {typeof exec.input === 'string' ? exec.input : JSON.stringify(exec.input)}
                              </Text>
                            )}
                          </View>
                          <Text style={{ color: colors.secondary, fontSize: 11 }}>
                            {isExpanded ? '▼' : '▶'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                      
                      {isExpanded && exec.output && (
                        <View style={[styles.toolOutput, { backgroundColor: colors.background }]}>
                          <ScrollView style={{ maxHeight: 200 }}>
                            <Text style={{ color: colors.text, fontSize: 11, fontFamily: 'monospace' }}>
                              {exec.output.length > 1000 
                                ? exec.output.substring(0, 1000) + '...\n[truncated]'
                                : exec.output}
                            </Text>
                          </ScrollView>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Subagents Section */}
          {meta?.subagentsUsed && meta?.subagentsUsed.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.placeholder }]}>
                🤖 Subagents Delegated
              </Text>
              <View style={{ marginTop: 4 }}>
                {meta?.subagentsUsed.map((subagent, idx) => (
                  <Text key={idx} style={{ color: colors.text, fontSize: 12 }}>
                    • {subagent}
                  </Text>
                ))}
              </View>
            </View>
          )}

          {/* Trust metrics from x402_trust_score */}
          {meta?.trustSignals && meta.trustSignals.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.placeholder }]}>
                🔐 Trust & Tokenomics (x402)
              </Text>
              <View style={{ marginTop: 4 }}>
                {meta.trustSignals.map((ts: any, idx: number) => (
                  <Text key={idx} style={{ color: colors.text, fontSize: 12 }}>
                    • {ts.ual} — score: {(ts.score ?? 0).toFixed(2)} — {ts.reason}
                  </Text>
                ))}
              </View>
            </View>
          )}

          {/* x402 Trust Portal (human-in-the-loop trust layer) */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.placeholder }]}>
              🧱 Trust Layer
            </Text>
            <Button
              color="secondary"
              flat
              text="Open x402 Trust Portal"
              onPress={() => {
                const url = "https://www.x402.org/protected";
                if (Platform.OS === "web" && typeof window !== "undefined") {
                  (window as any).open(url, "_blank");
                } else {
                  Linking.openURL(url).catch((err) =>
                    console.error("Failed to open x402 portal", err)
                  );
                }
              }}
            />
            <Text style={{ color: colors.secondary, fontSize: 11, marginTop: 4 }}>
              Optional: open the x402 portal to inspect or simulate staking / trust economics.
            </Text>
          </View>

          {/* Pending actions list (very simple text view for now) */}
          {meta?.type === "interrupt" && meta?.actionRequests && (
            <View style={{ marginTop: 8 }}>
              <Text style={[styles.label, { color: colors.placeholder }]}>
                Pending actions:
              </Text>
              {meta?.actionRequests.map((a: any, idx: number) => (
                <Text key={idx} style={{ color: colors.text, fontSize: 11 }}>
                  • {a.name}({JSON.stringify(a.args)})
                </Text>
              ))}
            </View>
          )}

          {/* Tiny human-in-the-loop controls */}
          {meta?.type === "interrupt" && meta?.actionRequests && onDecideInterrupt && (
            <View style={styles.actionsRow}>
              <Button
                color="primary"
                text="Approve all & resume"
                onPress={() => onDecideInterrupt("approve")}
              />
              <Button
                color="secondary"
                flat
                text="Reject all"
                onPress={() => onDecideInterrupt("reject")}
              />
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    marginTop: 4,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
  },
  threadId: {
    fontSize: 11,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    marginBottom: 4,
    gap: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: "500",
    minWidth: 64,
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 4,
  },
  todoItem: {
    marginBottom: 2,
    paddingLeft: 4,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  toolExecution: {
    padding: 10,
    borderRadius: 8,
    marginBottom: 4,
  },
  toolOutput: {
    padding: 8,
    borderRadius: 6,
    marginTop: 4,
    marginLeft: 8,
  },
  fileContent: {
    padding: 8,
    borderRadius: 6,
    marginTop: 4,
    marginLeft: 16,
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    gap: 8,
    marginTop: 8,
  },
});