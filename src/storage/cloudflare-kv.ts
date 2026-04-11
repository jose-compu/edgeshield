import type { StorageAdapter } from "../core/types";

export interface CloudflareKVNamespaceLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface CloudflareKVOptions {
  binding: CloudflareKVNamespaceLike;
  prefix?: string;
  retries?: number;
}

function toKey(prefix: string, key: string): string {
  const normalized = key.trim();
  if (!normalized) {
    throw new Error("Cloudflare KV key cannot be empty");
  }
  return `${prefix}:${normalized}`.slice(0, 512);
}

function ttlSeconds(ttlMs: number): number {
  return Math.max(1, Math.ceil(ttlMs / 1000));
}

export function cloudflareKV(options: CloudflareKVOptions): StorageAdapter {
  const prefix = options.prefix ?? "edgeshield";
  const retries = options.retries ?? 1;
  if (retries < 0 || retries > 5) {
    throw new Error("Cloudflare KV retries must be between 0 and 5");
  }

  async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  }

  return {
    async get(key: string): Promise<string | null> {
      return withRetry(() => options.binding.get(toKey(prefix, key)));
    },
    async set(key: string, value: string, ttlMs: number): Promise<void> {
      const storageKey = toKey(prefix, key);
      await withRetry(() =>
        options.binding.put(storageKey, value, { expirationTtl: ttlSeconds(ttlMs) })
      );
    },
    async increment(key: string, ttlMs: number): Promise<number> {
      const storageKey = toKey(prefix, key);
      return withRetry(async () => {
        const raw = await options.binding.get(storageKey);
        const current = raw ? Number.parseInt(raw, 10) : 0;
        const safeCurrent = Number.isFinite(current) ? current : 0;
        const next = safeCurrent + 1;
        await options.binding.put(storageKey, String(next), {
          expirationTtl: ttlSeconds(ttlMs)
        });
        return next;
      });
    },
    async delete(key: string): Promise<void> {
      await withRetry(() => options.binding.delete(toKey(prefix, key)));
    }
  };
}
