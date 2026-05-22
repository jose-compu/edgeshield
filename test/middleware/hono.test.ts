import { describe, expect, it, vi } from "vitest";
import { edgeshield } from "../../src/middleware/hono";

describe("hono middleware", () => {
  it("calls next when guards pass", async () => {
    const middleware = edgeshield({
      check: async () => ({ success: true, status: 200, reason: "ok" })
    });
    const next = vi.fn().mockResolvedValue(undefined);
    const context = {
      req: { raw: new Request("https://example.com") },
      newResponse: (body: BodyInit | null, status = 200, headers?: HeadersInit) =>
        new Response(body, headers ? { status, headers } : { status })
    };
    const result = await middleware(context, next);
    expect(result).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("returns blocked response when guard fails", async () => {
    const middleware = edgeshield({
      check: async () => ({ success: false, status: 403, reason: "blocked" })
    });
    const context = {
      req: { raw: new Request("https://example.com") },
      newResponse: (body: BodyInit | null, status = 200, headers?: HeadersInit) =>
        new Response(body, headers ? { status, headers } : { status })
    };
    const result = await middleware(context, async () => undefined);
    expect(result?.status).toBe(403);
  });

  it("returns HTML challenge body when guard provides one", async () => {
    const middleware = edgeshield({
      check: async () => ({
        success: false,
        status: 403,
        reason: "challenge_required",
        body: "<html>verify</html>",
        contentType: "text/html; charset=utf-8"
      })
    });
    const context = {
      req: { raw: new Request("https://example.com") },
      newResponse: (body: BodyInit | null, status = 200, headers?: HeadersInit) =>
        new Response(body, headers ? { status, headers } : { status })
    };
    const result = await middleware(context, async () => undefined);
    expect(result?.status).toBe(403);
    expect(result?.headers.get("content-type")).toContain("text/html");
    await expect(result?.text()).resolves.toBe("<html>verify</html>");
  });

  it("maps non-403 failures to 429", async () => {
    const middleware = edgeshield({
      check: async () => ({ success: false, status: 429, reason: "rate_limited" })
    });
    const context = {
      req: { raw: new Request("https://example.com") },
      newResponse: (body: BodyInit | null, status = 200, headers?: HeadersInit) =>
        new Response(body, headers ? { status, headers } : { status })
    };
    const result = await middleware(context, async () => undefined);
    expect(result?.status).toBe(429);
  });
});
