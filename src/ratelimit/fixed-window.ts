import { parseDuration } from "../core/time";
import type { AlgorithmState, DurationString, RateLimitAlgorithm, StorageAdapter } from "../core/types";

async function evaluateFixedWindow(
  storage: StorageAdapter,
  key: string,
  nowMs: number,
  limit: number,
  windowMs: number
): Promise<AlgorithmState> {
  const windowStartMs = Math.floor(nowMs / windowMs) * windowMs;
  const reset = windowStartMs + windowMs;
  const ttlMs = Math.max(1_000, reset - nowMs);
  const storageKey = `${key}:fixed:${windowStartMs}`;
  const count = await storage.increment(storageKey, ttlMs);
  const allowed = count <= limit;
  const remaining = allowed ? limit - count : 0;
  return { allowed, remaining, reset };
}

export function fixedWindow(limit: number, window: DurationString): RateLimitAlgorithm {
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error("Fixed window limit must be a positive integer");
  }
  const windowMs = parseDuration(window);
  return {
    kind: "fixed-window",
    limit,
    windowMs,
    evaluate: (storage: StorageAdapter, key: string, nowMs: number) =>
      evaluateFixedWindow(storage, key, nowMs, limit, windowMs)
  };
}
