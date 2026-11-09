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

function runUpstashCommand(
  store: Map<string, string>,
  command: Array<string | number>
): { result?: unknown; error?: string } {
  const [op, key, ...rest] = command;
  if (op === "GET") {
    return { result: store.get(String(key)) ?? null };
  }
  if (op === "SET") {
    store.set(String(key), String(rest[0]));
    return { result: "OK" };
  }
  if (op === "INCR") {
    const next = Number.parseInt(store.get(String(key)) ?? "0", 10) + 1;
    store.set(String(key), String(next));
    return { result: next };
  }
  if (op === "PEXPIRE") {
    return { result: 1 };
  }
  if (op === "DEL") {
    store.delete(String(key));
    return { result: 1 };
  }
  return { error: "unknown command" };
}

function createUpstashMock() {
  const store = new Map<string, string>();
  const fetchMock = vi.fn(async (_url: string | URL, init?: RequestInit) => {
    const body = typeof init?.body === "string" ? init.body : "[]";
    const parsed = JSON.parse(body) as Array<string | number> | Array<Array<string | number>>;

    if (Array.isArray(parsed[0])) {
      const rows = (parsed as Array<Array<string | number>>).map((cmd) => runUpstashCommand(store, cmd));
      return new Response(JSON.stringify(rows), { status: 200 });
    }

    const row = runUpstashCommand(store, parsed as Array<string | number>);
    return new Response(JSON.stringify(row), { status: 200 });
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
