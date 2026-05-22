import { describe, expect, it, vi } from "vitest";
import {
  runGuards,
  splitMiddlewareInput,
  toBlockedResponse
} from "../../src/middleware/guard-runner";

describe("guard-runner", () => {
  it("toBlockedResponse preserves 403 status and HTML body", async () => {
    const response = toBlockedResponse({
      success: false,
      status: 403,
      reason: "challenge_required",
      body: "<html>challenge</html>",
      contentType: "text/html; charset=utf-8",
      headers: new Headers({ "x-test": "1" })
    });
    expect(response.status).toBe(403);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("x-test")).toBe("1");
    await expect(response.text()).resolves.toBe("<html>challenge</html>");
  });

  it("toBlockedResponse maps non-403 failures to 429", async () => {
    const response = toBlockedResponse({
      success: false,
      status: 429,
      reason: "rate_limited"
    });
    expect(response.status).toBe(429);
  });

  it("splitMiddlewareInput separates guards from trailing options", () => {
    const guard = {
      check: async () => ({ success: true, status: 200 as const, reason: "ok" })
    };
    const options = { onBlocked: () => new Response("custom") };

    expect(splitMiddlewareInput([guard, options])).toEqual({
      guards: [guard],
      options
    });
    expect(splitMiddlewareInput([guard])).toEqual({ guards: [guard] });
  });

  it("runGuards uses onBlocked when provided", async () => {
    const onBlocked = vi.fn().mockReturnValue(new Response("handled", { status: 418 }));
    const result = await runGuards(
      new Request("https://example.com"),
      [{ check: async () => ({ success: false, status: 403, reason: "blocked" }) }],
      { onBlocked }
    );
    expect(onBlocked).toHaveBeenCalledOnce();
    expect(result?.status).toBe(418);
  });

  it("runGuards returns null when every guard passes", async () => {
    const result = await runGuards(new Request("https://example.com"), [
      { check: async () => ({ success: true, status: 200, reason: "ok" }) },
      { check: async () => ({ success: true, status: 200, reason: "ok" }) }
    ]);
    expect(result).toBeNull();
  });
});
