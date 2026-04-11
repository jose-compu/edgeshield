import { describe, expect, it } from "vitest";
import { fingerprintRequest } from "../../src/bot/fingerprint";

describe("fingerprintRequest", () => {
  it("returns low score for browser-like request", () => {
    const request = new Request("https://example.com", {
      headers: {
        "user-agent": "Mozilla/5.0",
        accept: "text/html",
        "accept-language": "en-US,en;q=0.9",
        "accept-encoding": "gzip, deflate, br",
        connection: "keep-alive"
      }
    });
    const result = fingerprintRequest(request);
    expect(result.score).toBe(0);
    expect(result.signals).toEqual([]);
  });

  it("returns high score for suspicious request", () => {
    const request = new Request("https://example.com", {
      headers: {
        connection: "upgrade",
        "cf-bot-score": "1"
      }
    });
    const result = fingerprintRequest(request);
    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(result.signals).toContain("missing_user_agent");
    expect(result.signals).toContain("low_cf_bot_score");
  });
});
