import { describe, expect, it } from "vitest";
import { presets as rootPresets } from "../../src/index";
import { presets } from "../../src/presets";
import { csrfGuard } from "../../src/csrf";
import { memory } from "../../src/storage/memory";

const CSRF_SECRET = "super-secret-csrf-key-123";

describe("presets subpath export", () => {
  it("imports from edgeshield/presets directly", () => {
    expect(typeof presets.api).toBe("function");
    expect(typeof presets.apiShield).toBe("function");
    expect(presets).toBe(rootPresets);
  });
});

describe("composite presets", () => {
  it("apiShield applies rate limit then bot guard", async () => {
    const storage = memory();
    const shield = presets.apiShield({
      storage,
      limit: 1,
      window: "1m",
      bot: { threshold: 80 }
    });
    const request = new Request("https://example.com", {
      headers: {
        "user-agent": "Mozilla/5.0",
        accept: "text/html",
        "accept-language": "en-US",
        "accept-encoding": "gzip"
      }
    });

    await expect(shield.check(request)).resolves.toMatchObject({ success: true });
    const blocked = await shield.check(request);
    expect(blocked.success).toBe(false);
    expect(blocked.status).toBe(429);
  });

  it("apiShield can include csrf when secret is provided", async () => {
    const storage = memory();
    const shield = presets.apiShield({
      storage,
      limit: 100,
      bot: false,
      csrfSecret: CSRF_SECRET
    });
    const blocked = await shield.check(
      new Request("https://example.com/form", { method: "POST" })
    );
    expect(blocked.success).toBe(false);
    expect(blocked.status).toBe(403);
  });

  it("authShield enforces strict rate limit and csrf", async () => {
    const storage = memory();
    const shield = presets.authShield({
      storage,
      csrfSecret: CSRF_SECRET,
      bot: false
    });
    const request = new Request("https://example.com/login", { method: "POST" });
    const result = await shield.check(request);
    expect(result.success).toBe(false);
    expect(result.status).toBe(403);
  });

  it("pageShield uses detect-only bot mode", async () => {
    const storage = memory();
    const shield = presets.pageShield({
      storage,
      bot: { threshold: 5 }
    });
    const suspicious = new Request("https://example.com");
    const result = await shield.check(suspicious);
    expect(result.success).toBe(true);
    expect(result.status).toBe(200);
  });

  it("pageShield without bot only rate limits", async () => {
    const storage = memory();
    const shield = presets.pageShield({
      storage,
      bot: false,
      limit: 1,
      window: "1m"
    });
    const request = new Request("https://example.com", {
      headers: {
        "user-agent": "Mozilla/5.0",
        accept: "text/html",
        "accept-language": "en-US",
        "accept-encoding": "gzip"
      }
    });

    await expect(shield.check(request)).resolves.toMatchObject({ success: true, reason: "ok" });
    const blocked = await shield.check(request);
    expect(blocked.success).toBe(false);
    expect(blocked.status).toBe(429);
  });

  it("apiShield without bot skips bot guard", async () => {
    const storage = memory();
    const shield = presets.apiShield({
      storage,
      bot: false,
      limit: 100
    });
    const suspicious = new Request("https://example.com");
    const result = await shield.check(suspicious);
    expect(result.success).toBe(true);
    expect(result.reason).toBe("ok");
  });

  it("authShield default bot guard blocks suspicious traffic", async () => {
    const storage = memory();
    const shield = presets.authShield({
      storage,
      csrfSecret: CSRF_SECRET,
      limit: 100
    });
    const result = await shield.check(new Request("https://example.com"));
    expect(result.success).toBe(false);
    expect(result.status).toBe(403);
  });

  it("authShield blocks on rate limit when csrf is valid", async () => {
    const storage = memory();
    const csrf = csrfGuard({ secret: CSRF_SECRET });
    const shield = presets.authShield({
      storage,
      csrfSecret: CSRF_SECRET,
      bot: false,
      limit: 1,
      window: "1m"
    });
    const token = await csrf.generate(new Request("https://example.com/login"));
    const request = new Request("https://example.com/login", {
      method: "POST",
      headers: {
        cookie: `__csrf=${token}`,
        "x-csrf-token": token,
        "user-agent": "Mozilla/5.0",
        accept: "text/html",
        "accept-language": "en-US",
        "accept-encoding": "gzip"
      }
    });

    await expect(shield.check(request)).resolves.toMatchObject({ success: true });
    const blocked = await shield.check(request);
    expect(blocked.success).toBe(false);
    expect(blocked.status).toBe(429);
  });

  it("authShield accepts valid csrf-protected login POST", async () => {
    const storage = memory();
    const csrf = csrfGuard({ secret: CSRF_SECRET });
    const shield = presets.authShield({
      storage,
      csrfSecret: CSRF_SECRET,
      bot: false,
      limit: 100
    });
    const token = await csrf.generate(new Request("https://example.com/login"));
    const result = await shield.check(
      new Request("https://example.com/login", {
        method: "POST",
        headers: {
          cookie: `__csrf=${token}`,
          "x-csrf-token": token,
          "user-agent": "Mozilla/5.0",
          accept: "text/html",
          "accept-language": "en-US",
          "accept-encoding": "gzip"
        }
      })
    );
    expect(result.success).toBe(true);
    expect(result.reason).toBe("ok");
  });

  it("apiShield blocks suspicious traffic when bot is enabled", async () => {
    const storage = memory();
    const shield = presets.apiShield({
      storage,
      limit: 100,
      bot: { threshold: 10 }
    });
    const result = await shield.check(new Request("https://example.com"));
    expect(result.success).toBe(false);
    expect(result.status).toBe(403);
  });
});
