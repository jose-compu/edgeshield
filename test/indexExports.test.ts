import { describe, expect, it } from "vitest";
import { memory, presets, rateLimit, slidingWindow, upstash } from "../src/index";

describe("public exports", () => {
  it("exports core constructors", () => {
    expect(typeof rateLimit).toBe("function");
    expect(typeof slidingWindow).toBe("function");
    expect(typeof memory).toBe("function");
    expect(typeof upstash).toBe("function");
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
});
