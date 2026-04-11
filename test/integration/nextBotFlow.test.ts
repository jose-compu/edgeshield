import { describe, expect, it } from "vitest";
import { botGuard } from "../../src/bot";
import { createMiddleware } from "../../src/middleware/nextjs";

describe("next middleware bot integration", () => {
  it("blocks suspicious request in block mode", async () => {
    const middleware = createMiddleware(
      botGuard({
        mode: "block",
        threshold: 5
      })
    );

    const result = await middleware(new Request("https://example.com"));
    expect(result?.status).toBe(403);
  });

  it("passes clean request", async () => {
    const middleware = createMiddleware(
      botGuard({
        mode: "block",
        threshold: 80
      })
    );

    const request = new Request("https://example.com", {
      headers: {
        "user-agent": "Mozilla/5.0",
        accept: "text/html",
        "accept-language": "en-US",
        "accept-encoding": "gzip"
      }
    });

    const result = await middleware(request);
    expect(result).toBeUndefined();
  });
});
