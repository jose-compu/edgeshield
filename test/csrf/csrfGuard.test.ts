import { describe, expect, it, vi } from "vitest";
import { csrfGuard } from "../../src/csrf";

const SECRET = "super-secret-csrf-key-123";

describe("csrfGuard", () => {
  it("requires secure secret length", () => {
    expect(() => csrfGuard({ secret: "short" })).toThrow("at least 16");
  });

  it("generates token and validates double-submit flow", async () => {
    const guard = csrfGuard({
      secret: SECRET,
      mode: "double-submit",
      cookie: { name: "__csrf" }
    });
    const token = await guard.generate(new Request("https://example.com/form"));
    const request = new Request("https://example.com/form", {
      method: "POST",
      headers: {
        cookie: `__csrf=${token}`,
        "x-csrf-token": token
      }
    });
    const result = await guard.verify(request);
    expect(result.valid).toBe(true);
    expect(result.reason).toBe("valid");
  });

  it("detects missing and mismatch token", async () => {
    const guard = csrfGuard({
      secret: SECRET,
      mode: "double-submit",
      cookie: { name: "__csrf" }
    });
    const missing = await guard.verify(
      new Request("https://example.com/form", {
        method: "POST"
      })
    );
    expect(missing.valid).toBe(false);
    expect(missing.reason).toBe("missing_token");

    const mismatch = await guard.verify(
      new Request("https://example.com/form", {
        method: "POST",
        headers: {
          cookie: "__csrf=a.b.c.d",
          "x-csrf-token": "a.b.c.e"
        }
      })
    );
    expect(mismatch.valid).toBe(false);
    expect(mismatch.reason).toBe("mismatch");
  });

  it("detects expired token", async () => {
    const now = vi.spyOn(Date, "now");
    now.mockReturnValue(1_000);

    const guard = csrfGuard({
      secret: SECRET,
      mode: "double-submit",
      ttl: "1s",
      cookie: { name: "__csrf" }
    });
    const token = await guard.generate(new Request("https://example.com/form"));

    now.mockReturnValue(3_000);
    const result = await guard.verify(
      new Request("https://example.com/form", {
        method: "POST",
        headers: {
          cookie: `__csrf=${token}`,
          "x-csrf-token": token
        }
      })
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("expired");
  });

  it("validates origin-check mode", async () => {
    const guard = csrfGuard({
      secret: SECRET,
      mode: "origin-check"
    });
    const valid = await guard.verify(
      new Request("https://example.com/form", {
        method: "POST",
        headers: {
          host: "example.com",
          origin: "https://example.com"
        }
      })
    );
    expect(valid.valid).toBe(true);

    const invalid = await guard.verify(
      new Request("https://example.com/form", {
        method: "POST",
        headers: {
          host: "example.com",
          origin: "https://evil.com"
        }
      })
    );
    expect(invalid.valid).toBe(false);
    expect(invalid.reason).toBe("origin_mismatch");

    const malformed = await guard.verify(
      new Request("https://example.com/form", {
        method: "POST",
        headers: {
          host: "example.com",
          referer: "not-a-url"
        }
      })
    );
    expect(malformed.valid).toBe(false);
    expect(malformed.reason).toBe("origin_mismatch");
  });

  it("honors ignorePaths and safe methods", async () => {
    const guard = csrfGuard({
      secret: SECRET,
      ignorePaths: ["/api/webhooks/**"]
    });

    const ignored = await guard.verify(
      new Request("https://example.com/api/webhooks/stripe", { method: "POST" })
    );
    expect(ignored.valid).toBe(true);

    const safeMethod = await guard.verify(
      new Request("https://example.com/form", { method: "GET" })
    );
    expect(safeMethod.valid).toBe(true);
  });

  it("check() returns middleware-compatible result", async () => {
    const guard = csrfGuard({ secret: SECRET });
    const blocked = await guard.check(
      new Request("https://example.com/form", {
        method: "POST"
      })
    );
    expect(blocked.success).toBe(false);
    expect(blocked.status).toBe(403);

    const token = await guard.generate(new Request("https://example.com/form"));
    const cookie = guard.buildCookie(token);
    expect(cookie).toContain("__csrf=");
  });
});
