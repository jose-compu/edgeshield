import { describe, expect, it } from "vitest";
import { blockedResponse, retryAfterSeconds } from "../../src/core/response";
import type { RateLimitResult } from "../../src/core/types";

function result(overrides: Partial<RateLimitResult> = {}): RateLimitResult {
  const headers = new Headers();
  headers.set("Retry-After", "12");
  return {
    success: false,
    status: 429,
    reason: "rate_limited",
    headers,
    meta: {
      remaining: 0,
      reset: Date.now() + 12_000,
      limit: 10,
      tier: "default"
    },
    ...overrides
  };
}

describe("retryAfterSeconds", () => {
  it("reads Retry-After when present", () => {
    expect(retryAfterSeconds(result())).toBe(12);
  });

  it("falls back to meta.reset when the header is missing", () => {
    const headers = new Headers();
    const value = retryAfterSeconds(
      result({
        headers,
        meta: { remaining: 0, reset: Date.now() + 5_400, limit: 10, tier: null }
      })
    );
    expect(value).toBeGreaterThanOrEqual(5);
    expect(value).toBeLessThanOrEqual(6);
  });
});

describe("blockedResponse", () => {
  it("returns JSON 429 with merged headers", async () => {
    const headers = new Headers({ "Retry-After": "3" });
    const response = blockedResponse(429, "rate_limited", headers);
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("3");
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({ error: "rate_limited", status: 429 });
  });
});
