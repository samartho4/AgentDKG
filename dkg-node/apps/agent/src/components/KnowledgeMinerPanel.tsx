import { View, Text, StyleSheet, Platform } from "react-native";
import useColors from "@/hooks/useColors";

type KMSubagent = { name: string; summary?: string };

type KMProps = {
  session: {
    sessionId: string;
    domain: string;
    task: string;
    todos: Array<{ content: string; status: string }>;
    workspacePaths: string[];
    subagentsUsed: KMSubagent[];
    trustSignals?: any[];
    mainReportPath?: string;
  };
};

export default function KnowledgeMinerPanel({ session }: KMProps) {
  const colors = useColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      <Text style={[styles.title, { color: colors.text }]}>
        Knowledge Miner Workspace
      </Text>
      <Text style={[styles.meta, { color: colors.cardText }]}>
        Domain: {session.domain} · Session: {session.sessionId.slice(0, 8)}…
      </Text>
      <Text style={[styles.meta, { color: colors.cardText }]}>
        Task: {session.task}
      </Text>

      {/* To-dos */}
      {session.todos?.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.secondary }]}>
            To-do plan
          </Text>
          {session.todos.map((t, i) => (
            <Text key={i} style={[styles.itemText, { color: colors.text }]}>
              {t.status === 'completed' ? '✅' : t.status === 'in_progress' ? '🔄' : '⏳'} {t.content}
            </Text>
          ))}
        </View>
      )}

      {/* Workspace files */}
      {session.workspacePaths?.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.secondary }]}>
            Workspace files
          </Text>
          {session.workspacePaths.map((p, i) => (
            <Text key={i} style={[styles.mono, { color: colors.cardText }]}>
              {p}
            </Text>
          ))}
        </View>
      )}

      {/* Subagents */}
      {session.subagentsUsed?.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.secondary }]}>
            Subagents used
          </Text>
          {session.subagentsUsed.map((s, i) => (
            <Text key={i} style={[styles.itemText, { color: colors.text }]}>
              • {s.name}
              {s.summary ? ` – ${s.summary}` : ""}
            </Text>
          ))}
        </View>
      )}

      {/* Trust signals */}
      {session.trustSignals && session.trustSignals.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.secondary }]}>
            Trust & tokenomics
          </Text>
          <Text style={[styles.itemText, { color: colors.text }]}>
            {JSON.stringify(session.trustSignals, null, 2)}
          </Text>
        </View>
      )}

      {session.mainReportPath && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.secondary }]}>
            Main report
          </Text>
          <Text style={[styles.mono, { color: colors.cardText }]}>
            {session.mainReportPath}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
  },
  meta: {
    fontSize: 12,
  },
  section: {
    marginTop: 12,
    gap: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
  },
  itemText: {
    fontSize: 13,
  },
  mono: {
    fontSize: 12,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
});
