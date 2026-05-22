import { describe, expect, it } from "vitest";
import type { StorageAdapter } from "../../src/core/types";
import { botGuard, VDF } from "../../src/bot";
import { memory } from "../../src/storage/memory";

describe("botGuard", () => {
  it("throws for invalid threshold", () => {
    expect(() => botGuard({ threshold: 0 })).toThrow();
    expect(() => botGuard({ threshold: 101 })).toThrow();
    expect(() => botGuard({ vdf: { steps: 0 } })).toThrow("vdf.steps");
    expect(() => botGuard({ vdf: { maxAgeMs: 0 } })).toThrow("maxAgeMs");
  });

  it("detect mode never blocks", async () => {
    const guard = botGuard({
      mode: "detect",
      threshold: 10
    });

    const request = new Request("https://example.com");
    const result = await guard.check(request);
    expect(result.success).toBe(true);
    expect(result.status).toBe(200);
    expect(result.reason).toBe("detected_suspicious");
  });

  it("block mode blocks suspicious traffic", async () => {
    const guard = botGuard({
      mode: "block",
      threshold: 10
    });
    const result = await guard.check(new Request("https://example.com"));
    expect(result.success).toBe(false);
    expect(result.status).toBe(403);
    expect(result.reason).toBe("blocked_suspicious");
  });

  it("block rules are enforced in block mode", async () => {
    const guard = botGuard({
      mode: "block",
      rules: {
        block: [/curl/i]
      }
    });
    const request = new Request("https://example.com", {
      headers: { "user-agent": "curl/8.0" }
    });
    const result = await guard.check(request);
    expect(result.success).toBe(false);
    expect(result.reason).toBe("blocked_ua");
  });

  it("allow rules bypass block patterns", async () => {
    const guard = botGuard({
      mode: "block",
      rules: {
        allow: [/googlebot/i],
        block: [/bot/i]
      }
    });
    const request = new Request("https://example.com", {
      headers: { "user-agent": "googlebot" }
    });
    const result = await guard.check(request);
    expect(result.success).toBe(true);
    expect(result.reason).toBe("allowlisted_ua");
  });

  it("requires VDF challenge before allowing suspicious traffic", async () => {
    const guard = botGuard({
      mode: "block",
      threshold: 10,
      vdf: { enabled: true, steps: 2, maxAgeMs: 60_000 }
    });
    const suspicious = new Request("https://example.com");

    const first = await guard.check(suspicious);
    expect(first.success).toBe(false);
    expect(first.reason).toBe("vdf_challenge_required");

    const challengeValue = first.headers.get("x-edgeshield-vdf-challenge");
    const challengeHex = challengeValue?.split(".")[0] ?? "";
    const solution = await VDF.compute(challengeHex, 2);

    const second = await guard.check(
      new Request("https://example.com", {
        headers: {
          "x-edgeshield-vdf-challenge": challengeValue ?? "",
          "x-edgeshield-vdf-solution": solution
        }
      })
    );
    expect(second.success).toBe(true);
    expect(second.reason).toBe("vdf_passed");
  });

  it("fails VDF challenge with invalid proof", async () => {
    const guard = botGuard({
      mode: "block",
      threshold: 10,
      vdf: { enabled: true, steps: 2, maxAgeMs: 60_000 }
    });

    const first = await guard.check(new Request("https://example.com"));
    const challengeValue = first.headers.get("x-edgeshield-vdf-challenge") ?? "";

    const second = await guard.check(
      new Request("https://example.com", {
        headers: {
          "x-edgeshield-vdf-challenge": challengeValue,
          "x-edgeshield-vdf-solution": "deadbeef"
        }
      })
    );
    expect(second.success).toBe(false);
    expect(second.reason).toBe("vdf_failed");
  });

  it("fails VDF challenge when expired", async () => {
    const guard = botGuard({
      mode: "block",
      threshold: 10,
      vdf: { enabled: true, steps: 2, maxAgeMs: 1 }
    });
    const expiredChallenge = `${"ab".repeat(16)}.${Date.now() - 10_000}`;
    const result = await guard.check(
      new Request("https://example.com", {
        headers: {
          "x-edgeshield-vdf-challenge": expiredChallenge,
          "x-edgeshield-vdf-solution": "00"
        }
      })
    );
    expect(result.success).toBe(false);
    expect(result.reason).toBe("vdf_failed");
  });

  it("challenge mode returns HTML page for suspicious traffic", async () => {
    const guard = botGuard({
      mode: "challenge",
      threshold: 10,
      vdf: { steps: 2, maxAgeMs: 60_000 }
    });

    const result = await guard.check(new Request("https://example.com"));
    expect(result.success).toBe(false);
    expect(result.reason).toBe("challenge_required");
    expect(result.contentType).toBe("text/html; charset=utf-8");
    expect(result.body).toContain("<!DOCTYPE html>");
  });

  it("challenge mode passes after valid VDF proof", async () => {
    const guard = botGuard({
      mode: "challenge",
      threshold: 10,
      vdf: { steps: 2, maxAgeMs: 60_000 }
    });

    const first = await guard.check(new Request("https://example.com"));
    const challengeValue = first.headers.get("x-edgeshield-vdf-challenge") ?? "";
    const challengeHex = challengeValue.split(".")[0] ?? "";
    const solution = await VDF.compute(challengeHex, 2);

    const second = await guard.check(
      new Request("https://example.com", {
        headers: {
          "x-edgeshield-vdf-challenge": challengeValue,
          "x-edgeshield-vdf-solution": solution
        }
      })
    );
    expect(second.success).toBe(true);
    expect(second.reason).toBe("challenge_passed");
  });

  it("challenge mode supports custom renderer", async () => {
    const guard = botGuard({
      mode: "challenge",
      threshold: 10,
      vdf: { steps: 2 },
      challenge: {
        renderer: () => "<html>custom</html>"
      }
    });

    const result = await guard.check(new Request("https://example.com"));
    expect(result.body).toBe("<html>custom</html>");
  });

  it("challenge mode rejects replayed solutions with storage", async () => {
    const storage: StorageAdapter = memory();
    const guard = botGuard({
      mode: "challenge",
      threshold: 10,
      vdf: { steps: 2, maxAgeMs: 60_000 },
      storage
    });

    const first = await guard.check(new Request("https://example.com"));
    const challengeValue = first.headers.get("x-edgeshield-vdf-challenge") ?? "";
    const challengeHex = challengeValue.split(".")[0] ?? "";
    const solution = await VDF.compute(challengeHex, 2);
    const headers = {
      "x-edgeshield-vdf-challenge": challengeValue,
      "x-edgeshield-vdf-solution": solution
    };

    const pass = await guard.check(new Request("https://example.com", { headers }));
    expect(pass.success).toBe(true);

    const replay = await guard.check(new Request("https://example.com", { headers }));
    expect(replay.success).toBe(false);
    expect(replay.reason).toBe("challenge_failed");
  });

  it("detect mode allows blocked user agents", async () => {
    const guard = botGuard({
      mode: "detect",
      rules: { block: [/curl/i] }
    });
    const result = await guard.check(
      new Request("https://example.com", {
        headers: { "user-agent": "curl/8.0" }
      })
    );
    expect(result.success).toBe(true);
    expect(result.reason).toBe("blocked_ua");
  });

  it("challenge mode fails expired proof with fresh HTML page", async () => {
    const guard = botGuard({
      mode: "challenge",
      threshold: 10,
      vdf: { steps: 2, maxAgeMs: 1 }
    });
    const expiredChallenge = `${"ab".repeat(16)}.${Date.now() - 10_000}`;
    const result = await guard.check(
      new Request("https://example.com", {
        headers: {
          "x-edgeshield-vdf-challenge": expiredChallenge,
          "x-edgeshield-vdf-solution": "00"
        }
      })
    );
    expect(result.success).toBe(false);
    expect(result.reason).toBe("challenge_failed");
    expect(result.body).toContain("<!DOCTYPE html>");
  });

  it("challenge mode fails invalid proof with fresh HTML page", async () => {
    const guard = botGuard({
      mode: "challenge",
      threshold: 10,
      vdf: { steps: 2, maxAgeMs: 60_000 }
    });
    const first = await guard.check(new Request("https://example.com"));
    const challengeValue = first.headers.get("x-edgeshield-vdf-challenge") ?? "";

    const result = await guard.check(
      new Request("https://example.com", {
        headers: {
          "x-edgeshield-vdf-challenge": challengeValue,
          "x-edgeshield-vdf-solution": "bad-proof"
        }
      })
    );
    expect(result.success).toBe(false);
    expect(result.reason).toBe("challenge_failed");
    expect(result.body).toContain("<!DOCTYPE html>");
  });

  it("challenge mode with vdf disabled behaves like detect", async () => {
    const guard = botGuard({
      mode: "challenge",
      threshold: 10,
      vdf: { enabled: false }
    });
    const result = await guard.check(new Request("https://example.com"));
    expect(result.success).toBe(true);
    expect(result.reason).toBe("detected_suspicious");
  });

  it("passes clean traffic in challenge mode", async () => {
    const guard = botGuard({
      mode: "challenge",
      threshold: 80
    });
    const request = new Request("https://example.com", {
      headers: {
        "user-agent": "Mozilla/5.0",
        accept: "text/html",
        "accept-language": "en-US",
        "accept-encoding": "gzip"
      }
    });
    const result = await guard.check(request);
    expect(result.success).toBe(true);
    expect(result.reason).toBe("passed");
  });

  it("supports custom VDF header names in block mode", async () => {
    const guard = botGuard({
      mode: "block",
      threshold: 10,
      vdf: {
        enabled: true,
        steps: 2,
        challengeHeader: "x-custom-challenge",
        solutionHeader: "x-custom-solution"
      }
    });

    const first = await guard.check(new Request("https://example.com"));
    expect(first.headers.get("x-custom-challenge")).toBeTruthy();
    const challengeValue = first.headers.get("x-custom-challenge") ?? "";
    const challengeHex = challengeValue.split(".")[0] ?? "";
    const solution = await VDF.compute(challengeHex, 2);

    const second = await guard.check(
      new Request("https://example.com", {
        headers: {
          "x-custom-challenge": challengeValue,
          "x-custom-solution": solution
        }
      })
    );
    expect(second.success).toBe(true);
    expect(second.reason).toBe("vdf_passed");
  });
});
