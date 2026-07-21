import { parseRate } from "../core/time";
import type { AlgorithmState, RateLimitAlgorithm, RateString, StorageAdapter } from "../core/types";

interface LeakyBucketState {
  level: number;
  updatedAtMs: number;
}

function parseState(raw: string | null, nowMs: number): LeakyBucketState {
  if (!raw) {
    return { level: 0, updatedAtMs: nowMs };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<LeakyBucketState>;
    return {
      level: typeof parsed.level === "number" && Number.isFinite(parsed.level) ? parsed.level : 0,
      updatedAtMs:
        typeof parsed.updatedAtMs === "number" && Number.isFinite(parsed.updatedAtMs)
          ? parsed.updatedAtMs
          : nowMs
    };
  } catch {
    return { level: 0, updatedAtMs: nowMs };
  }
}

function drain(state: LeakyBucketState, nowMs: number, ratePerMs: number): number {
  const elapsed = Math.max(0, nowMs - state.updatedAtMs);
  return Math.max(0, state.level - elapsed * ratePerMs);
}

async function evaluateLeakyBucket(
  storage: StorageAdapter,
  key: string,
  nowMs: number,
  capacity: number,
  ratePerMs: number,
  fullDrainMs: number
): Promise<AlgorithmState> {
  const storageKey = `${key}:leaky`;
  const raw = await storage.get(storageKey);
  const state = parseState(raw, nowMs);
  const level = drain(state, nowMs, ratePerMs);

  const allowed = level + 1 <= capacity;
  const nextLevel = allowed ? level + 1 : level;
  const remaining = allowed ? Math.max(0, Math.floor(capacity - nextLevel)) : 0;
  const reset = allowed
    ? nowMs + Math.ceil(nextLevel / ratePerMs)
    : nowMs + Math.ceil((level + 1 - capacity) / ratePerMs);

  await storage.set(
    storageKey,
    JSON.stringify({ level: nextLevel, updatedAtMs: nowMs } satisfies LeakyBucketState),
    Math.max(60_000, fullDrainMs * 2)
  );

  return { allowed, remaining, reset };
}

export function leakyBucket(capacity: number, drainRate: RateString): RateLimitAlgorithm {
  if (!Number.isInteger(capacity) || capacity <= 0) {
    throw new Error("Leaky bucket capacity must be a positive integer");
  }
  const ratePerMs = parseRate(drainRate);
  const fullDrainMs = Math.ceil(capacity / ratePerMs);
  return {
    kind: "leaky-bucket",
    limit: capacity,
    windowMs: fullDrainMs,
    evaluate: (storage, key, nowMs) =>
      evaluateLeakyBucket(storage, key, nowMs, capacity, ratePerMs, fullDrainMs)
  };
}
