/**
 * Cloudflare KV adapter against real workerd KV (miniflare).
 * getKVNamespace() hangs on some hosts; ops go through a small Worker + dispatchFetch.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Miniflare } from "miniflare";
import { cloudflareKV } from "../../src/storage/cloudflare-kv";
import { rateLimit, slidingWindow } from "../../src/ratelimit";
import type { CloudflareKVNamespaceLike } from "../../src/storage/cloudflare-kv";

const WORKER = `
export default {
  async fetch(request, env) {
    const body = await request.json();
    const { op, key, value, ttl } = body;
    if (op === "get") {
      return Response.json({ value: await env.EDGE_KV.get(key) });
    }
    if (op === "put") {
      const options = ttl != null ? { expirationTtl: ttl } : undefined;
      await env.EDGE_KV.put(key, value, options);
      return Response.json({ ok: true });
    }
    if (op === "delete") {
      await env.EDGE_KV.delete(key);
      return Response.json({ ok: true });
    }
    return Response.json({ error: "unknown op" }, { status: 400 });
  }
};
`;

function workerdKvBinding(mf: Miniflare): CloudflareKVNamespaceLike {
  async function call(payload: Record<string, unknown>) {
    const res = await mf.dispatchFetch("http://edgeshield.local/kv", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      throw new Error(`workerd KV proxy failed: ${res.status} ${await res.text()}`);
    }
    return res.json() as Promise<{ value?: string | null; ok?: boolean }>;
  }

  return {
    async get(key: string) {
      const row = await call({ op: "get", key });
      return row.value ?? null;
    },
    async put(key: string, value: string, options?: { expirationTtl?: number }) {
      await call({
        op: "put",
        key,
        value,
        ttl: options?.expirationTtl
      });
    },
    async delete(key: string) {
      await call({ op: "delete", key });
    }
  };
}

describe("cloudflareKV under miniflare / workerd", () => {
  let mf: Miniflare;
  let binding: CloudflareKVNamespaceLike;

  beforeAll(async () => {
    mf = new Miniflare({
      modules: true,
      script: WORKER,
      kvNamespaces: ["EDGE_KV"]
    });
    await mf.ready;
    binding = workerdKvBinding(mf);
  }, 60_000);

  afterAll(async () => {
    await mf?.dispose();
  });

  it("get / set / increment / delete with TTL through adapter", async () => {
    const storage = cloudflareKV({ binding, prefix: "mf" });
    const key = `smoke-${Date.now()}`;

    await expect(storage.get(key)).resolves.toBeNull();
    await storage.set(key, "hello", 60_000);
    await expect(storage.get(key)).resolves.toBe("hello");

    await expect(storage.increment(key, 60_000)).resolves.toBe(1);
    // set stored non-numeric "hello"; increment treats NaN as 0 → 1, then 2
    await storage.set(key, "5", 60_000);
    await expect(storage.increment(key, 60_000)).resolves.toBe(6);
    await expect(storage.get(key)).resolves.toBe("6");

    await storage.delete(key);
    await expect(storage.get(key)).resolves.toBeNull();
  });

  it("rate-limit sliding window against workerd KV", async () => {
    const storage = cloudflareKV({ binding, prefix: "rl" });
    const id = `ip-miniflare-${Date.now()}`;
    const limiter = rateLimit({
      storage,
      algorithm: slidingWindow(2, "1m"),
      identifier: () => id
    });

    const req = new Request("https://example.com/api");
    await expect(limiter.check(req).then((r) => r.success)).resolves.toBe(true);
    await expect(limiter.check(req).then((r) => r.success)).resolves.toBe(true);
    await expect(limiter.check(req).then((r) => r.success)).resolves.toBe(false);
  });
});
