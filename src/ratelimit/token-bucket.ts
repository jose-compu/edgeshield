import { parseRate } from "../core/time";
import type { AlgorithmState, RateLimitAlgorithm, RateString, StorageAdapter } from "../core/types";

interface TokenBucketState {
  tokens: number;
  updatedAtMs: number;
}

function parseState(raw: string | null, capacity: number, nowMs: number): TokenBucketState {
  if (!raw) {
    return { tokens: capacity, updatedAtMs: nowMs };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<TokenBucketState>;
    return {
      tokens: typeof parsed.tokens === "number" && Number.isFinite(parsed.tokens) ? parsed.tokens : capacity,
      updatedAtMs:
        typeof parsed.updatedAtMs === "number" && Number.isFinite(parsed.updatedAtMs)
          ? parsed.updatedAtMs
          : nowMs
    };
  } catch {
    return { tokens: capacity, updatedAtMs: nowMs };
  }
}

function refill(state: TokenBucketState, nowMs: number, capacity: number, ratePerMs: number): number {
  const elapsed = Math.max(0, nowMs - state.updatedAtMs);
  return Math.min(capacity, state.tokens + elapsed * ratePerMs);
}

async function evaluateTokenBucket(
  storage: StorageAdapter,
  key: string,
  nowMs: number,
  capacity: number,
  ratePerMs: number,
  fullRefillMs: number
): Promise<AlgorithmState> {
  const storageKey = `${key}:token`;
  const raw = await storage.get(storageKey);
  const state = parseState(raw, capacity, nowMs);
  const tokens = refill(state, nowMs, capacity, ratePerMs);

  const allowed = tokens >= 1;
  const nextTokens = allowed ? tokens - 1 : tokens;
  const remaining = allowed ? Math.max(0, Math.floor(nextTokens)) : 0;
  const deficit = allowed ? 0 : 1 - tokens;
  const reset = allowed
    ? nowMs + Math.ceil((capacity - nextTokens) / ratePerMs)
    : nowMs + Math.ceil(deficit / ratePerMs);

  await storage.set(
    storageKey,
    JSON.stringify({ tokens: nextTokens, updatedAtMs: nowMs } satisfies TokenBucketState),
    Math.max(60_000, fullRefillMs * 2)
  );

  return { allowed, remaining, reset };
}

export function tokenBucket(capacity: number, refillRate: RateString): RateLimitAlgorithm {
  if (!Number.isInteger(capacity) || capacity <= 0) {
    throw new Error("Token bucket capacity must be a positive integer");
  }
  const ratePerMs = parseRate(refillRate);
  const fullRefillMs = Math.ceil(capacity / ratePerMs);
  return {
    kind: "token-bucket",
    limit: capacity,
    windowMs: fullRefillMs,
    evaluate: (storage, key, nowMs) =>
      evaluateTokenBucket(storage, key, nowMs, capacity, ratePerMs, fullRefillMs)
  };
}
