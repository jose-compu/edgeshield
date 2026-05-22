import { assertEquals } from "jsr:@std/assert@1";
import { rateLimit, slidingWindow } from "../../dist/ratelimit/index.js";
import { memory } from "../../dist/storage/memory.js";
import { shield } from "../../dist/middleware/generic.js";
import { botGuard } from "../../dist/bot/index.js";

Deno.test("built dist memory adapter satisfies storage contract", async () => {
  const adapter = memory();
  await adapter.set("deno-key", "ok", 60_000);
  assertEquals(await adapter.get("deno-key"), "ok");
  assertEquals(await adapter.increment("deno-count", 60_000), 1);
  await adapter.delete("deno-key");
  assertEquals(await adapter.get("deno-key"), null);
});

Deno.test("built dist rate limiter runs on Deno", async () => {
  const limiter = rateLimit({
    storage: memory(),
    algorithm: slidingWindow(2, "1m"),
    identifier: () => "deno-user"
  });
  const request = new Request("https://example.com");
  const first = await limiter.check(request);
  const second = await limiter.check(request);
  assertEquals(first.success, true);
  assertEquals(second.success, true);
});

Deno.test("built dist generic shield composes guards", async () => {
  const protect = shield(
    botGuard({
      mode: "block",
      threshold: 80,
      rules: { allow: [/deno/i] }
    })
  );
  const allowed = await protect(
    new Request("https://example.com", {
      headers: { "user-agent": "deno/2.0" }
    })
  );
  assertEquals(allowed, null);
});
