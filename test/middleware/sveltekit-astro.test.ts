import { describe, expect, it } from "vitest";
import { createAstroMiddleware } from "../../src/middleware/astro";
import { createSvelteKitHandle } from "../../src/middleware/sveltekit";
import { rateLimit, fixedWindow } from "../../src/ratelimit";
import { memory } from "../../src/storage/memory";

describe("SvelteKit and Astro middleware helpers", () => {
  it("createSvelteKitHandle blocks when guard fails", async () => {
    const limiter = rateLimit({
      storage: memory(),
      algorithm: fixedWindow(1, "1m"),
      identifier: () => "sk"
    });
    const handle = createSvelteKitHandle(limiter);
    const event = { request: new Request("https://example.com") };
    await handle({
      event,
      resolve: async () => new Response("ok")
    });
    const second = await handle({
      event,
      resolve: async () => new Response("ok")
    });
    expect(second.status).toBe(429);
  });

  it("createAstroMiddleware calls next when allowed", async () => {
    const limiter = rateLimit({
      storage: memory(),
      algorithm: fixedWindow(5, "1m"),
      identifier: () => "astro"
    });
    const mw = createAstroMiddleware(limiter);
    const res = await mw({ request: new Request("https://example.com") }, async () => new Response("next"));
    expect(await res.text()).toBe("next");
  });
});
