import { unixSeconds } from "./time";
import type { RateLimitResult } from "./types";

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

/** Seconds until `result.meta.reset`, preferring the `Retry-After` header when present. */
export function retryAfterSeconds(result: RateLimitResult): number {
  const header = result.headers.get("Retry-After");
  if (header != null && header !== "") {
    const parsed = Number(header);
    if (Number.isFinite(parsed) && parsed >= 0) return Math.floor(parsed);
  }
  return Math.max(0, Math.ceil((result.meta.reset - Date.now()) / 1000));
}

export function blockedResponse(
  status: 429 | 403,
  reason: string,
  headers?: Headers,
  bodyOverride?: { body: string; contentType: string }
): Response {
  const merged = new Headers(headers);
  if (bodyOverride) {
    merged.set("content-type", bodyOverride.contentType);
    return new Response(bodyOverride.body, { status, headers: merged });
  }
  const body = JSON.stringify({
    error: reason,
    status
  });
  merged.set("content-type", "application/json; charset=utf-8");
  return new Response(body, { status, headers: merged });
}
