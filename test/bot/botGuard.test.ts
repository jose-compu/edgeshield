import { describe, expect, it } from "vitest";
import { botGuard, VDF } from "../../src/bot";

describe("botGuard", () => {
  it("throws for invalid threshold", () => {
    expect(() => botGuard({ threshold: 0 })).toThrow();
    expect(() => botGuard({ threshold: 101 })).toThrow();
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
});
