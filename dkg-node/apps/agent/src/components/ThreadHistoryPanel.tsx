// apps/agent/src/components/ThreadHistoryPanel.tsx
import React, { memo } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";

export type ThreadSummary = {
  id: string;
  sessionId: string;
  title: string;
  domain?: string;
  task?: string;
  createdAt: number;
  updatedAt: number;
};

type ThreadHistoryPanelProps = {
  threads: ThreadSummary[];
  activeThreadId: string | null;
  onSelectThread: (thread: ThreadSummary) => void;
  onNewSession: () => void;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
};

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

const ThreadHistoryPanel: React.FC<ThreadHistoryPanelProps> = memo((props) => {
  const {
    threads,
    activeThreadId,
    onSelectThread,
    onNewSession,
    isCollapsed,
    onToggleCollapsed,
  } = props;

  return (
    <View style={[styles.root, isCollapsed && styles.rootCollapsed]}>
      <View style={styles.header}>
        {!isCollapsed && <Text style={styles.title}>Thread history</Text>}
        <View style={styles.headerButtons}>
          <Pressable
            onPress={onToggleCollapsed}
            style={styles.iconButton}
            hitSlop={10}
          >
            <Text style={styles.iconText}>{isCollapsed ? "⮞" : "⮜"}</Text>
          </Pressable>
          {!isCollapsed && (
            <Pressable onPress={onNewSession} style={styles.newSessionButton}>
              <Text style={styles.newSessionText}>New session</Text>
            </Pressable>
          )}
        </View>
      </View>
      {!isCollapsed && (
        <ScrollView style={styles.list}>
          {threads.map((t) => {
            const isActive = t.id === activeThreadId;
            return (
              <Pressable
                key={t.id}
                style={[styles.threadItem, isActive && styles.threadItemActive]}
                onPress={() => onSelectThread(t)}
              >
                <Text numberOfLines={1} style={styles.threadTitle}>
                  {t.title}
                </Text>
                <Text numberOfLines={1} style={styles.threadMeta}>
                  {t.domain ?? "general"} • {formatRelativeTime(t.updatedAt)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
    width: 280,
  },
  rootCollapsed: {
    width: 40,
    paddingHorizontal: 4,
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  title: {
    color: "white",
    fontSize: 13,
    fontWeight: "600",
  },
  headerButtons: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  iconButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  iconText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 11,
  },
  newSessionButton: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "rgba(132,94,247,0.25)",
  },
  newSessionText: {
    color: "white",
    fontSize: 11,
    fontWeight: "500",
  },
  list: {
    marginTop: 4,
  },
  threadItem: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 4,
  },
  threadItemActive: {
    backgroundColor: "rgba(132,94,247,0.25)",
  },
  threadTitle: {
    color: "white",
    fontSize: 12,
    fontWeight: "500",
  },
  threadMeta: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 11,
    marginTop: 1,
  },
});

export default ThreadHistoryPanel;
