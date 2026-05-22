import type { StorageAdapter } from "../core/types";

export interface DenoKvEntry<T> {
  value: T | null;
  versionstamp: string | null;
}

export interface DenoKvLike {
  get<T = unknown>(key: readonly string[]): Promise<DenoKvEntry<T>>;
  set(key: readonly string[], value: unknown, options?: { expireIn?: number }): Promise<void>;
  delete(key: readonly string[]): Promise<void>;
}

export interface DenoKvOptions {
  kv: DenoKvLike;
  prefix?: string;
}

function toKey(prefix: string, key: string): string[] {
  const normalized = key.trim();
  if (!normalized) {
    throw new Error("Deno KV key cannot be empty");
  }
  return [prefix, normalized];
}

export function denoKV(options: DenoKvOptions): StorageAdapter {
  const prefix = options.prefix ?? "edgeshield";

  return {
    async get(key: string): Promise<string | null> {
      const entry = await options.kv.get<string>(toKey(prefix, key));
      if (entry.value === null || entry.value === undefined) {
        return null;
      }
      return String(entry.value);
    },
    async set(key: string, value: string, ttlMs: number): Promise<void> {
      await options.kv.set(toKey(prefix, key), value, {
        expireIn: Math.max(1, Math.floor(ttlMs))
      });
    },
    async increment(key: string, ttlMs: number): Promise<number> {
      const kvKey = toKey(prefix, key);
      const entry = await options.kv.get<number>(kvKey);
      const raw = entry.value;
      const parsed = typeof raw === "number" ? raw : Number.parseInt(String(raw ?? "0"), 10);
      const current = Number.isFinite(parsed) ? parsed : 0;
      const next = current + 1;
      await options.kv.set(kvKey, next, { expireIn: Math.max(1, Math.floor(ttlMs)) });
      return next;
    },
    async delete(key: string): Promise<void> {
      await options.kv.delete(toKey(prefix, key));
    }
  };
}
