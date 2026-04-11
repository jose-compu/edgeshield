import type { StorageAdapter } from "../core/types";

export interface VercelKvLike {
  get(key: string): Promise<string | null>;
  set(
    key: string,
    value: string,
    options?: {
      px?: number;
    }
  ): Promise<unknown>;
  del(key: string): Promise<unknown>;
  incr(key: string): Promise<number>;
  pexpire?(key: string, ttlMs: number): Promise<unknown>;
}

export interface VercelKvOptions {
  client: VercelKvLike;
  prefix?: string;
}

function toKey(prefix: string, key: string): string {
  const normalized = key.trim();
  if (!normalized) {
    throw new Error("Vercel KV key cannot be empty");
  }
  return `${prefix}:${normalized}`.slice(0, 512);
}

export function vercelKV(options: VercelKvOptions): StorageAdapter {
  const prefix = options.prefix ?? "edgeshield";

  return {
    async get(key: string): Promise<string | null> {
      return options.client.get(toKey(prefix, key));
    },
    async set(key: string, value: string, ttlMs: number): Promise<void> {
      await options.client.set(toKey(prefix, key), value, {
        px: Math.max(1, Math.floor(ttlMs))
      });
    },
    async increment(key: string, ttlMs: number): Promise<number> {
      const storageKey = toKey(prefix, key);
      const next = await options.client.incr(storageKey);
      if (options.client.pexpire) {
        await options.client.pexpire(storageKey, Math.max(1, Math.floor(ttlMs)));
      } else {
        const existing = await options.client.get(storageKey);
        if (existing !== null) {
          await options.client.set(storageKey, existing, {
            px: Math.max(1, Math.floor(ttlMs))
          });
        }
      }
      return next;
    },
    async delete(key: string): Promise<void> {
      await options.client.del(toKey(prefix, key));
    }
  };
}
