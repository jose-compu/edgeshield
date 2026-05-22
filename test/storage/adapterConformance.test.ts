import { afterEach, describe, vi } from "vitest";
import { cloudflareKV } from "../../src/storage/cloudflare-kv";
import { denoKV, type DenoKvLike } from "../../src/storage/deno-kv";
import { memory } from "../../src/storage/memory";
import { upstash } from "../../src/storage/upstash";
import { vercelKV } from "../../src/storage/vercel-kv";
import { describeStorageAdapterConformance } from "./conformance";

function createCloudflareBinding() {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    })
  };
}

function createVercelClient() {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    del: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    incr: vi.fn(async (key: string) => {
      const next = Number.parseInt(store.get(key) ?? "0", 10) + 1;
      store.set(key, String(next));
      return next;
    }),
    pexpire: vi.fn(async () => undefined)
  };
}

function createUpstashMock() {
  const store = new Map<string, string>();
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    const body = typeof init?.body === "string" ? init.body : "[]";
    const command = JSON.parse(body) as Array<string | number>;
    const [op, key, ...rest] = command;

    if (op === "GET") {
      return new Response(JSON.stringify({ result: store.get(String(key)) ?? null }), { status: 200 });
    }
    if (op === "SET") {
      store.set(String(key), String(rest[0]));
      return new Response(JSON.stringify({ result: "OK" }), { status: 200 });
    }
    if (op === "INCR") {
      const next = Number.parseInt(store.get(String(key)) ?? "0", 10) + 1;
      store.set(String(key), String(next));
      return new Response(JSON.stringify({ result: next }), { status: 200 });
    }
    if (op === "PEXPIRE") {
      return new Response(JSON.stringify({ result: 1 }), { status: 200 });
    }
    if (op === "DEL") {
      store.delete(String(key));
      return new Response(JSON.stringify({ result: 1 }), { status: 200 });
    }
    return new Response(JSON.stringify({ error: "unknown command" }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return upstash({
    url: "https://example.upstash.io",
    token: "valid-token"
  });
}

function createDenoKvMock(): DenoKvLike {
  const store = new Map<string, unknown>();
  const keyString = (key: readonly string[]) => key.join(":");
  return {
    async get<T>(key: readonly string[]) {
      const value = store.get(keyString(key));
      return {
        value: (value ?? null) as T | null,
        versionstamp: value === undefined ? null : "v1"
      };
    },
    async set(key, value) {
      store.set(keyString(key), value);
    },
    async delete(key) {
      store.delete(keyString(key));
    }
  };
}

describe("adapter conformance suite", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describeStorageAdapterConformance("memory", () => memory());
  describeStorageAdapterConformance("deno-kv", () => denoKV({ kv: createDenoKvMock() }));
  describeStorageAdapterConformance("cloudflare-kv", () =>
    cloudflareKV({ binding: createCloudflareBinding() })
  );
  describeStorageAdapterConformance("vercel-kv", () =>
    vercelKV({ client: createVercelClient(), prefix: "test" })
  );
  describeStorageAdapterConformance("upstash", () => createUpstashMock());
});
