import { beforeEach, describe, expect, it, vi } from "vitest";
import { fixedWindow, rateLimit, slidingWindow } from "../../src/ratelimit";
import { memory } from "../../src/storage/memory";

describe("rateLimit", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("allows request and emits headers", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_000);
    const limiter = rateLimit({
      storage: memory(),
      algorithm: slidingWindow(2, "1m"),
      identifier: () => "user-1"
    });

    const result = await limiter.check(new Request("https://example.com"));
    expect(result.success).toBe(true);
    expect(result.status).toBe(200);
    expect(result.reason).toBe("ok");
    expect(result.headers.get("RateLimit-Limit")).toBe("2");
  });

  it("blocks when fixed window exceeds limit", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_000);
    const limiter = rateLimit({
      storage: memory(),
      algorithm: fixedWindow(1, "1m"),
      identifier: () => "user-2"
    });

    await limiter.check(new Request("https://example.com"));
    const second = await limiter.check(new Request("https://example.com"));
    expect(second.success).toBe(false);
    expect(second.status).toBe(429);
    expect(second.reason).toBe("rate_limited");
    expect(second.headers.get("Retry-After")).toBeTruthy();
  });

  it("supports multi-tier policies and reports tier", async () => {
    vi.spyOn(Date, "now").mockReturnValue(2_000);
    const limiter = rateLimit({
      storage: memory(),
      tiers: [
        { name: "burst", algorithm: fixedWindow(1, "1m") },
        { name: "daily", algorithm: fixedWindow(100, "1d") }
      ],
      identifier: () => "user-3"
    });

    await limiter.check(new Request("https://example.com"));
    const blocked = await limiter.check(new Request("https://example.com"));
    expect(blocked.success).toBe(false);
    expect(blocked.meta.tier).toBe("burst");
  });

  it("fail-opens by default on storage errors", async () => {
    const limiter = rateLimit({
      storage: {
        get: async () => {
          throw new Error("fail");
        },
        set: async () => undefined,
        increment: async () => {
          throw new Error("fail");
        },
        delete: async () => undefined
      },
      algorithm: fixedWindow(1, "1m")
    });

    const result = await limiter.check(new Request("https://example.com"));
    expect(result.success).toBe(true);
    expect(result.reason).toBe("storage_error");
  });

  it("can fail-closed on storage errors", async () => {
    const limiter = rateLimit({
      storage: {
        get: async () => {
          throw new Error("fail");
        },
        set: async () => undefined,
        increment: async () => {
          throw new Error("fail");
        },
        delete: async () => undefined
      },
      algorithm: fixedWindow(1, "1m"),
      failOpen: false
    });

    const result = await limiter.check(new Request("https://example.com"));
    expect(result.success).toBe(false);
    expect(result.reason).toBe("storage_error");
    expect(result.status).toBe(429);
  });

  it("normalizes long custom identifiers", async () => {
    const limiter = rateLimit({
      storage: memory(),
      algorithm: fixedWindow(1, "1m"),
      identifier: () => `  ${"A".repeat(500)}  `
    });
    const result = await limiter.check(new Request("https://example.com"));
    expect(result.success).toBe(true);
  });
});
