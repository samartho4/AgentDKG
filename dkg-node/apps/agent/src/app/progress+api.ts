/**
 * Server-Sent Events (SSE) endpoint for real-time progress updates
 * from DeepAgents knowledge mining sessions
 */

import { progressChannels } from '@/shared/progress';

export function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get('sessionId');

  if (!sessionId) {
    return new Response('Missing sessionId parameter', { status: 400 });
  }

  // Initialize channel if it doesn't exist
  if (!progressChannels.has(sessionId)) {
    progressChannels.set(sessionId, []);
  }

  const encoder = new TextEncoder();
  let intervalId: any;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      const initialData = `data: ${JSON.stringify({ type: 'connected', sessionId })}\n\n`;
      controller.enqueue(encoder.encode(initialData));

      // Poll for updates and send them
      intervalId = setInterval(() => {
        const updates = progressChannels.get(sessionId);
        if (updates && updates.length > 0) {
          const update = updates.shift();
          const data = `data: ${JSON.stringify(update)}\n\n`;
          controller.enqueue(encoder.encode(data));

          // If this is a completion message, close the stream
          if (update.type === 'complete' || update.type === 'error') {
            clearInterval(intervalId);
            // Clean up after a delay to allow client to receive final message
            setTimeout(() => {
              progressChannels.delete(sessionId);
              controller.close();
            }, 1000);
          }
        }
      }, 100);

      // Cleanup on client disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(intervalId);
        controller.close();
      });
    },
    cancel() {
      clearInterval(intervalId);
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

// Re-export from shared module for convenience
export { publishProgress, cleanupSession } from '@/shared/progress';
