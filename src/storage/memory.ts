import type { StorageAdapter } from "../core/types";

interface Entry {
  value: string;
  expiresAt: number;
}

/**
 * In-process {@link StorageAdapter} backed by a `Map`.
 *
 * Suitable for unit tests, single-instance Node/Bun processes, and local demos.
 * Entries expire by wall-clock TTL; expired keys are removed on read/write.
 * Not shared across isolates, Workers, or multiple server processes.
 *
 * @returns A {@link StorageAdapter} with `get`, `set`, `increment`, and `delete`.
 *
 * @example
 * ```ts
 * import { memory } from "edgeshield/storage/memory";
 * import { rateLimit, slidingWindow } from "edgeshield";
 *
 * const storage = memory();
 * const limiter = rateLimit({
 *   storage,
 *   algorithm: slidingWindow(100, "15m")
 * });
 * ```
 */
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
    /** Read a string value, or `null` if missing/expired. */
    async get(key: string): Promise<string | null> {
      return prune(key)?.value ?? null;
    },
    /**
     * Store a string value with a TTL.
     * @param ttlMs Time-to-live in milliseconds (minimum 1ms).
     */
    async set(key: string, value: string, ttlMs: number): Promise<void> {
      store.set(key, {
        value,
        expiresAt: Date.now() + Math.max(1, ttlMs)
      });
    },
    /**
     * Atomically increment a numeric counter (stored as decimal string).
     * Missing or expired keys start at 0 before increment.
     * @param ttlMs TTL applied after each increment (milliseconds).
     * @returns The value after increment.
     */
    async increment(key: string, ttlMs: number): Promise<number> {
      const entry = prune(key);
      const next = (entry ? Number.parseInt(entry.value, 10) : 0) + 1;
      store.set(key, {
        value: String(next),
        expiresAt: Date.now() + Math.max(1, ttlMs)
      });
      return next;
    },
    /** Remove a key if present. */
    async delete(key: string): Promise<void> {
      store.delete(key);
    }
  };
}
