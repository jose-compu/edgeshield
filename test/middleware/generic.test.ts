import { describe, expect, it, vi } from "vitest";
import { botGuard } from "../../src/bot";
import { blockedResponse } from "../../src/core/response";
import { runGuards, shield } from "../../src/middleware/generic";
import { memory } from "../../src/storage/memory";
import { rateLimit, slidingWindow } from "../../src/ratelimit";

describe("generic middleware", () => {
  it("returns null when all guards pass", async () => {
    const protect = shield({
      check: async () => ({ success: true, status: 200, reason: "ok" })
    });
    const result = await protect(new Request("https://example.com"));
    expect(result).toBeNull();
  });

  it("returns blocked response when a guard fails", async () => {
    const protect = shield({
      check: async () => ({ success: false, status: 429, reason: "rate_limited" })
    });
    const result = await protect(new Request("https://example.com"));
    expect(result?.status).toBe(429);
  });

  it("returns HTML body when guard provides challenge page", async () => {
    const protect = shield({
      check: async () => ({
        success: false,
        status: 403,
        reason: "challenge_required",
        body: "<html>verify</html>",
        contentType: "text/html; charset=utf-8"
      })
    });
    const result = await protect(new Request("https://example.com"));
    expect(result?.headers.get("content-type")).toContain("text/html");
    await expect(result?.text()).resolves.toBe("<html>verify</html>");
  });

  it("supports onBlocked override", async () => {
    const protect = shield(
      {
        check: async () => ({ success: false, status: 403, reason: "blocked" })
      },
      {
        onBlocked: () => blockedResponse(403, "custom")
      }
    );
    const result = await protect(new Request("https://example.com"));
    await expect(result?.json()).resolves.toEqual({ error: "custom", status: 403 });
  });

  it("runGuards executes guards in order and stops at first failure", async () => {
    const second = vi.fn();
    const blocked = await runGuards(new Request("https://example.com"), [
      { check: async () => ({ success: true, status: 200, reason: "ok" }) },
      { check: async () => ({ success: false, status: 403, reason: "blocked" }) },
      { check: second }
    ]);
    expect(blocked?.status).toBe(403);
    expect(second).not.toHaveBeenCalled();
  });

  it("composes multiple real guards through shield", async () => {
    const storage = memory();
    const protect = shield(
      rateLimit({ storage, algorithm: slidingWindow(100, "15m") }),
      botGuard({ mode: "block", threshold: 80 })
    );
    const request = new Request("https://example.com", {
      headers: {
        "user-agent": "Mozilla/5.0",
        accept: "text/html",
        "accept-language": "en-US",
        "accept-encoding": "gzip"
      }
    });
    expect(await protect(request)).toBeNull();
  });
});
