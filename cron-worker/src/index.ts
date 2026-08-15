export interface Env {
  TARGET_URL?: string;
}

export default {
  // 1. Cron Trigger: runs every 13 minutes on Cloudflare Edge network
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const url = env.TARGET_URL || "https://antigravity-ui-cx0g.onrender.com/api/health";
    console.log(`[Cron Trigger ${event.cron}] Pinging ${url} at ${new Date(event.scheduledTime).toISOString()}`);

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Cloudflare-Cron-Worker-KeepAlive/1.0",
          "Accept": "application/json",
        },
      });
      const status = response.status;
      const body = await response.text();
      console.log(`[Keep-Alive Result] Status: ${status}, Body: ${body.slice(0, 100)}`);
    } catch (err: any) {
      console.error(`[Keep-Alive Failed] Error pinging ${url}:`, err);
    }
  },

  // 2. HTTP Fetch Handler (manual trigger or health check for the worker itself)
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = env.TARGET_URL || "https://antigravity-ui-cx0g.onrender.com/api/health";
    const startTime = Date.now();
    try {
      const resp = await fetch(url, {
        headers: { "User-Agent": "Cloudflare-Cron-Worker-Manual/1.0" },
      });
      const latencyMs = Date.now() - startTime;
      const text = await resp.text();

      return new Response(
        JSON.stringify({
          success: true,
          status: resp.status,
          latencyMs,
          targetUrl: url,
          timestamp: new Date().toISOString(),
          upstreamResponse: text,
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (err: any) {
      return new Response(
        JSON.stringify({
          success: false,
          error: err.message,
          targetUrl: url,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  },
};
