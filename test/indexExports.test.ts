import { describe, expect, it } from "vitest";
import {
  createMiddleware,
  createVdfChallenge,
  csrfGuard,
  denoKV,
  honoMiddleware,
  memory,
  presets,
  rateLimit,
  runGuards,
  shield,
  slidingWindow,
  upstash,
  VDF,
  vercelKV
} from "../src/index";

describe("public exports", () => {
  it("exports core constructors", () => {
    expect(typeof rateLimit).toBe("function");
    expect(typeof slidingWindow).toBe("function");
    expect(typeof memory).toBe("function");
    expect(typeof upstash).toBe("function");
    expect(typeof createVdfChallenge).toBe("function");
    expect(typeof VDF.compute).toBe("function");
    expect(typeof csrfGuard).toBe("function");
    expect(typeof vercelKV).toBe("function");
    expect(typeof honoMiddleware).toBe("function");
    expect(typeof createMiddleware).toBe("function");
    expect(typeof shield).toBe("function");
    expect(typeof runGuards).toBe("function");
    expect(typeof denoKV).toBe("function");
    expect(typeof presets.apiShield).toBe("function");
  });

  it("builds preset limiters", async () => {
    const storage = memory();
    const limiter = presets.api({ storage, limit: 2, window: "1m" });
    const request = new Request("https://example.com");

    const first = await limiter.check(request);
    const second = await limiter.check(request);

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
  });

  it("builds auth and page presets with defaults", async () => {
    const storage = memory();
    const authLimiter = presets.auth({ storage });
    const pageLimiter = presets.page({ storage });
    const request = new Request("https://example.com");

    const auth = await authLimiter.check(request);
    const page = await pageLimiter.check(request);

    expect(auth.success).toBe(true);
    expect(page.success).toBe(true);
  });

  it("supports preset custom prefixes", async () => {
    const storage = memory();
    const limiter = presets.api({ storage, prefix: "custom-prefix", limit: 1, window: "1m" });
    const result = await limiter.check(new Request("https://example.com"));
    expect(result.success).toBe(true);
  });

  it("builds api preset with default values", async () => {
    const storage = memory();
    const limiter = presets.api({ storage });
    const result = await limiter.check(new Request("https://example.com"));
    expect(result.success).toBe(true);
  });
});
