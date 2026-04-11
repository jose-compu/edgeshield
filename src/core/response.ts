import { unixSeconds } from "./time";

interface BuildHeadersInput {
  limit: number;
  remaining: number;
  resetMs: number;
  allowed: boolean;
}

export function buildRateLimitHeaders(input: BuildHeadersInput): Headers {
  const headers = new Headers();
  const resetSeconds = Math.max(0, unixSeconds(input.resetMs - Date.now()));
  headers.set("RateLimit-Limit", String(Math.max(0, input.limit)));
  headers.set("RateLimit-Remaining", String(Math.max(0, input.remaining)));
  headers.set("RateLimit-Reset", String(resetSeconds));
  if (!input.allowed) {
    headers.set("Retry-After", String(resetSeconds));
  }
  return headers;
}

export function blockedResponse(
  status: 429 | 403,
  reason: string,
  headers?: Headers
): Response {
  const body = JSON.stringify({
    error: reason,
    status
  });
  const merged = new Headers(headers);
  merged.set("content-type", "application/json; charset=utf-8");
  return new Response(body, { status, headers: merged });
}
