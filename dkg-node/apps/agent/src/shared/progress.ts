/**
 * Shared progress publishing utilities for DeepAgents
 * This allows the plugin to publish progress updates that the SSE endpoint can stream
 */

// Simple in-memory store (same reference as in progress+api.ts)
const progressChannels = new Map<string, any[]>();

export type ProgressUpdate = {
  type: 'status' | 'tool_start' | 'tool_complete' | 'tool_error' | 'complete' | 'error';
  message?: string;
  tool?: string;
  input?: any;
  output?: any;
  progress?: number;
  timestamp?: number;
};

export function publishProgress(sessionId: string, update: ProgressUpdate) {
  if (!progressChannels.has(sessionId)) {
    progressChannels.set(sessionId, []);
  }
  progressChannels.get(sessionId)!.push({
    ...update,
    timestamp: Date.now(),
  });
}

export function getProgressChannel(sessionId: string): any[] {
  if (!progressChannels.has(sessionId)) {
    progressChannels.set(sessionId, []);
  }
  return progressChannels.get(sessionId)!;
}

export function cleanupSession(sessionId: string) {
  progressChannels.delete(sessionId);
}

// Export the map for SSE endpoint to access
export { progressChannels };
