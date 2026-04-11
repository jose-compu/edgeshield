import { parseDuration } from "../core/time";
import type { AlgorithmState, DurationString, RateLimitAlgorithm, StorageAdapter } from "../core/types";

interface SlidingWindowState {
  currentStartMs: number;
  currentCount: number;
  previousStartMs: number;
  previousCount: number;
}

function parseState(raw: string | null, windowStartMs: number, previousStartMs: number): SlidingWindowState {
  if (!raw) {
    return {
      currentStartMs: windowStartMs,
      currentCount: 0,
      previousStartMs,
      previousCount: 0
    };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<SlidingWindowState>;
    return {
      currentStartMs: typeof parsed.currentStartMs === "number" ? parsed.currentStartMs : windowStartMs,
      currentCount: typeof parsed.currentCount === "number" ? parsed.currentCount : 0,
      previousStartMs: typeof parsed.previousStartMs === "number" ? parsed.previousStartMs : previousStartMs,
      previousCount: typeof parsed.previousCount === "number" ? parsed.previousCount : 0
    };
  } catch {
    return {
      currentStartMs: windowStartMs,
      currentCount: 0,
      previousStartMs,
      previousCount: 0
    };
  }
}

async function evaluateSlidingWindow(
  storage: StorageAdapter,
  key: string,
  nowMs: number,
  limit: number,
  windowMs: number
): Promise<AlgorithmState> {
  const storageKey = `${key}:sliding`;
  const windowStartMs = Math.floor(nowMs / windowMs) * windowMs;
  const previousStartMs = windowStartMs - windowMs;
  const raw = await storage.get(storageKey);
  const state = parseState(raw, windowStartMs, previousStartMs);

  if (state.currentStartMs !== windowStartMs) {
    state.previousStartMs = state.currentStartMs;
    state.previousCount = state.currentCount;
    state.currentStartMs = windowStartMs;
    state.currentCount = 0;
  }

  state.currentCount += 1;
  const elapsed = nowMs - state.currentStartMs;
  const previousWeight = Math.max(0, 1 - elapsed / windowMs);
  const weighted = state.currentCount + state.previousCount * previousWeight;
  const allowed = weighted <= limit;
  const remaining = allowed ? Math.max(0, Math.floor(limit - weighted)) : 0;
  const reset = state.currentStartMs + windowMs;

  const ttlMs = windowMs * 2;
  await storage.set(storageKey, JSON.stringify(state), ttlMs);
  return { allowed, remaining, reset };
}

export function slidingWindow(limit: number, window: DurationString): RateLimitAlgorithm {
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error("Sliding window limit must be a positive integer");
  }
  const windowMs = parseDuration(window);
  return {
    kind: "sliding-window",
    limit,
    windowMs,
    evaluate: (storage, key, nowMs) =>
      evaluateSlidingWindow(storage, key, nowMs, limit, windowMs)
  };
}
