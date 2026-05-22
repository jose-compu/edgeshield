import { describe, expect, it } from "vitest";
import { createMiddleware } from "../../src/middleware/nextjs";
import { blockedResponse } from "../../src/core/response";

describe("nextjs middleware", () => {
  it("returns undefined when all guards pass", async () => {
    const middleware = createMiddleware({
      check: async () => ({ success: true, status: 200, reason: "ok" })
    });
    const result = await middleware(new Request("https://example.com"));
    expect(result).toBeUndefined();
  });

  it("returns blocked response when a guard fails", async () => {
    const middleware = createMiddleware({
      check: async () => ({ success: false, status: 429, reason: "rate_limited" })
    });
    const result = await middleware(new Request("https://example.com"));
    expect(result?.status).toBe(429);
  });

  it("uses custom onBlocked callback", async () => {
    const middleware = createMiddleware(
      {
        check: async () => ({ success: false, status: 403, reason: "blocked" })
      },
      {
        onBlocked: () => blockedResponse(403, "custom")
      }
    );
    const result = await middleware(new Request("https://example.com"));
    expect(result?.status).toBe(403);
    await expect(result?.json()).resolves.toEqual({
      error: "custom",
      status: 403
    });
  });

  it("returns HTML challenge body when guard provides one", async () => {
    const middleware = createMiddleware({
      check: async () => ({
        success: false,
        status: 403,
        reason: "challenge_required",
        body: "<html>verify</html>",
        contentType: "text/html; charset=utf-8"
      })
    });
    const result = await middleware(new Request("https://example.com"));
    expect(result?.status).toBe(403);
    expect(result?.headers.get("content-type")).toContain("text/html");
    await expect(result?.text()).resolves.toBe("<html>verify</html>");
  });
});
