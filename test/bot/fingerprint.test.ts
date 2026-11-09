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

  it.each([
    ["Googlebot", "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"],
    ["Bingbot", "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)"],
    ["curl", "curl/8.4.0"],
    ["wget", "Wget/1.21.3"],
    ["python-requests", "python-requests/2.31.0"],
    ["Postman", "PostmanRuntime/7.36.0"],
    ["httpie", "HTTPie/3.2.2"]
  ])("flags %s user-agent as automated_client_ua", (_label, ua) => {
    const result = fingerprintRequest(
      new Request("https://example.com", {
        headers: {
          "user-agent": ua,
          accept: "*/*",
          "accept-language": "en",
          "accept-encoding": "gzip",
          connection: "keep-alive"
        }
      })
    );
    expect(result.signals).toContain("automated_client_ua");
    expect(result.score).toBeGreaterThanOrEqual(40);
  });
});
