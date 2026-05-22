import { describe, expect, it } from "vitest";
import { botGuard, VDF } from "../../src/bot";
import { csrfGuard } from "../../src/csrf";
import { shield } from "../../src/middleware/generic";
import { createMiddleware } from "../../src/middleware/nextjs";
import { presets } from "../../src/presets";
import { memory } from "../../src/storage/memory";
import { rateLimit, slidingWindow } from "../../src/ratelimit";

const CSRF_SECRET = "super-secret-csrf-key-123";

describe("integrated shield flows", () => {
  it("generic shield returns HTML for bot challenge mode", async () => {
    const protect = shield(
      botGuard({
        mode: "challenge",
        threshold: 10,
        vdf: { steps: 2, maxAgeMs: 60_000 }
      })
    );

    const blocked = await protect(new Request("https://example.com"));
    expect(blocked?.status).toBe(403);
    await expect(blocked?.text()).resolves.toContain("<!DOCTYPE html>");
  });

  it("generic shield passes after VDF proof in block mode", async () => {
    const protect = shield(
      botGuard({
        mode: "block",
        threshold: 10,
        vdf: { enabled: true, steps: 2, maxAgeMs: 60_000 }
      })
    );

    const first = await protect(new Request("https://example.com"));
    const challengeValue = first?.headers.get("x-edgeshield-vdf-challenge") ?? "";
    const challengeHex = challengeValue.split(".")[0] ?? "";
    const solution = await VDF.compute(challengeHex, 2);

    const second = await protect(
      new Request("https://example.com", {
        headers: {
          "x-edgeshield-vdf-challenge": challengeValue,
          "x-edgeshield-vdf-solution": solution
        }
      })
    );
    expect(second).toBeNull();
  });

  it("next middleware composes rate limit and csrf guards", async () => {
    const storage = memory();
    const csrf = csrfGuard({ secret: CSRF_SECRET });
    const middleware = createMiddleware(
      rateLimit({
        storage,
        algorithm: slidingWindow(100, "15m")
      }),
      csrf
    );

    const token = await csrf.generate(new Request("https://example.com/form"));
    const allowed = await middleware(
      new Request("https://example.com/form", {
        method: "POST",
        headers: {
          cookie: `__csrf=${token}`,
          "x-csrf-token": token
        }
      })
    );
    expect(allowed).toBeUndefined();
  });

  it("apiShield full stack accepts valid csrf-protected POST", async () => {
    const storage = memory();
    const csrf = csrfGuard({ secret: CSRF_SECRET });
    const apiShield = presets.apiShield({
      storage,
      limit: 100,
      bot: false,
      csrfSecret: CSRF_SECRET
    });
    const token = await csrf.generate(new Request("https://example.com/api/items"));

    const result = await apiShield.check(
      new Request("https://example.com/api/items", {
        method: "POST",
        headers: {
          cookie: `__csrf=${token}`,
          "x-csrf-token": token
        }
      })
    );
    expect(result.success).toBe(true);
    expect(result.reason).toBe("ok");
  });
});
