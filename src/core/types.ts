export interface StorageAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlMs: number): Promise<void>;
  increment(key: string, ttlMs: number): Promise<number>;
  delete(key: string): Promise<void>;
}

export type DurationString = `${number}${"s" | "m" | "h" | "d"}`;

export type IdentifierFn = (request: Request) => string | Promise<string>;

export interface AlgorithmState {
  allowed: boolean;
  remaining: number;
  reset: number;
}

export interface RateLimitAlgorithm {
  kind: "sliding-window" | "fixed-window";
  limit: number;
  windowMs: number;
  evaluate(storage: StorageAdapter, key: string, nowMs: number): Promise<AlgorithmState>;
}

export interface RateLimitTier {
  name: string;
  algorithm: RateLimitAlgorithm;
}

export interface RateLimitResult {
  success: boolean;
  status: 200 | 429;
  reason: "ok" | "rate_limited" | "storage_error";
  headers: Headers;
  meta: {
    remaining: number;
    reset: number;
    limit: number;
    tier: string | null;
  };
}

export interface RateLimitConfig {
  storage: StorageAdapter;
  algorithm?: RateLimitAlgorithm;
  tiers?: RateLimitTier[];
  identifier?: IdentifierFn;
  prefix?: string;
  failOpen?: boolean;
}

export interface RateLimiter {
  check(request: Request): Promise<RateLimitResult>;
}
