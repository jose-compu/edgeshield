import type { StorageAdapter } from "../core/types";

interface Entry {
  value: string;
  expiresAt: number;
}

export function memory(): StorageAdapter {
  const store = new Map<string, Entry>();

  const prune = (key: string): Entry | null => {
    const entry = store.get(key);
    if (!entry) {
      return null;
    }
    if (entry.expiresAt <= Date.now()) {
      store.delete(key);
      return null;
    }
    return entry;
  };

  return {
    async get(key: string): Promise<string | null> {
      return prune(key)?.value ?? null;
    },
    async set(key: string, value: string, ttlMs: number): Promise<void> {
      store.set(key, {
        value,
        expiresAt: Date.now() + Math.max(1, ttlMs)
      });
    },
    async increment(key: string, ttlMs: number): Promise<number> {
      const entry = prune(key);
      const next = (entry ? Number.parseInt(entry.value, 10) : 0) + 1;
      store.set(key, {
        value: String(next),
        expiresAt: Date.now() + Math.max(1, ttlMs)
      });
      return next;
    },
    async delete(key: string): Promise<void> {
      store.delete(key);
    }
  };
}
