import { describe, expect, it, vi } from "vitest";
import { defaultIdentifier, extractClientIp, sanitizeIdentifier } from "../../src/core/identity";
import { blockedResponse, buildRateLimitHeaders } from "../../src/core/response";

describe("core identity and response helpers", () => {
  it("extracts client ip from preferred headers", () => {
    const request = new Request("https://example.com", {
      headers: {
        "x-forwarded-for": "1.2.3.4, 5.6.7.8"
      }
    });
    expect(extractClientIp(request)).toBe("1.2.3.4");
  });

  it("sanitizes identifiers", () => {
    expect(sanitizeIdentifier("  A B C  ")).toBe("a_b_c");
    expect(sanitizeIdentifier("")).toBe("anonymous");
  });

  it("builds consistent headers", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_000);
    const headers = buildRateLimitHeaders({
      limit: 10,
      remaining: 3,
      resetMs: 11_000,
      allowed: false
    });
    expect(headers.get("RateLimit-Limit")).toBe("10");
    expect(headers.get("RateLimit-Remaining")).toBe("3");
    expect(headers.get("Retry-After")).toBe("10");
  });

  it("builds blocked response body", async () => {
    const response = blockedResponse(429, "rate_limited");
    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({
      error: "rate_limited",
      status: 429
    });
  });

  it("builds blocked response with custom HTML body", async () => {
    const response = blockedResponse(403, "challenge_required", new Headers(), {
      body: "<html>challenge</html>",
      contentType: "text/html; charset=utf-8"
    });
    expect(response.status).toBe(403);
    expect(response.headers.get("content-type")).toContain("text/html");
    await expect(response.text()).resolves.toBe("<html>challenge</html>");
  });

  it("returns anonymous default identifier without ip", () => {
    const request = new Request("https://example.com");
    expect(defaultIdentifier(request)).toBe("anonymous");
  });
});
