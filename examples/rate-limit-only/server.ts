/**
 * Minimal rate-limit-only HTTP sample (Node 22+ / Bun).
 * From repo root: `npx tsx examples/rate-limit-only/server.ts`
 */
import { createServer } from "node:http";
import {
  rateLimit,
  slidingWindow,
  memory,
  blockedResponse,
  retryAfterSeconds
} from "../../src/index.ts";

const storage = memory();
const limiter = rateLimit({
  storage,
  prefix: "example:rl",
  algorithm: slidingWindow(5, "1m")
});

const port = Number(process.env.PORT ?? 8787);

createServer(async (req, res) => {
  const host = req.headers.host ?? "127.0.0.1";
  const request = new Request(`http://${host}${req.url ?? "/"}`, {
    method: req.method,
    headers: req.headers as HeadersInit
  });

  const result = await limiter.check(request);
  if (!result.success) {
    const response = blockedResponse(429, result.reason, result.headers);
    const retry = retryAfterSeconds(result);
    const text = await response.text();
    res.writeHead(result.status, {
      "content-type": response.headers.get("content-type") ?? "application/json",
      ...(retry != null ? { "retry-after": String(retry) } : {}),
      ...Object.fromEntries(result.headers.entries())
    });
    res.end(text);
    return;
  }

  res.writeHead(200, {
    "content-type": "application/json",
    ...Object.fromEntries(result.headers.entries())
  });
  res.end(JSON.stringify({ ok: true, remaining: result.meta?.remaining }));
}).listen(port, () => {
  console.log(`rate-limit-only example on http://127.0.0.1:${port}`);
});
