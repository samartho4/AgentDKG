/**
 * Plugin to provide SSE endpoint for DeepAgents progress updates
 */
import { defineDkgPlugin } from "@dkg/plugins";
import { progressChannels } from "@/shared/progress";

export default defineDkgPlugin((_ctx, _mcp, api) => {
  // Register SSE endpoint for progress updates
  api.get("/progress", (req, res) => {
    const sessionId = req.query.sessionId as string;
    
    if (!sessionId) {
      res.status(400).send('Missing sessionId parameter');
      return;
    }

    // Initialize channel if it doesn't exist
    if (!progressChannels.has(sessionId)) {
      progressChannels.set(sessionId, []);
    }

    // Set up SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: 'connected', sessionId })}\n\n`);

    // Poll for updates
    const intervalId = setInterval(() => {
      const updates = progressChannels.get(sessionId);
      if (updates && updates.length > 0) {
        const update = updates.shift();
        res.write(`data: ${JSON.stringify(update)}\n\n`);

        // Close on completion
        if (update.type === 'complete' || update.type === 'error') {
          clearInterval(intervalId);
          setTimeout(() => {
            progressChannels.delete(sessionId);
            res.end();
          }, 1000);
        }
      }
    }, 100);

    // Cleanup on client disconnect
    req.on('close', () => {
      clearInterval(intervalId);
      res.end();
    });
  });
});
