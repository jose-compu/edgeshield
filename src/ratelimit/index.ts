import { defaultIdentifier, sanitizeIdentifier } from "../core/identity";
import { buildRateLimitHeaders } from "../core/response";
import type { RateLimitConfig, RateLimitResult, RateLimiter, RateLimitTier } from "../core/types";
import { fixedWindow } from "./fixed-window";
import { slidingWindow } from "./sliding-window";

function resolveTiers(config: RateLimitConfig): RateLimitTier[] {
  if (config.tiers && config.tiers.length > 0) {
    return config.tiers;
  }
  if (config.algorithm) {
    return [{ name: "default", algorithm: config.algorithm }];
  }
  return [{ name: "default", algorithm: slidingWindow(60, "1m") }];
}

function makeResult(
  allowed: boolean,
  reason: RateLimitResult["reason"],
  limit: number,
  remaining: number,
  reset: number,
  tier: string | null
): RateLimitResult {
  return {
    success: allowed,
    status: allowed ? 200 : 429,
    reason,
    headers: buildRateLimitHeaders({
      limit,
      remaining,
      resetMs: reset,
      allowed
    }),
    meta: { remaining, reset, limit, tier }
  };
}

export function rateLimit(config: RateLimitConfig): RateLimiter {
  const tiers = resolveTiers(config);
  if (tiers.length === 0) {
    throw new Error("At least one rate limit tier is required");
  }
  const prefix = config.prefix ?? "edgeshield";
  const failOpen = config.failOpen ?? true;

  return {
    async check(request: Request): Promise<RateLimitResult> {
      const rawId = config.identifier
        ? await config.identifier(request)
        : defaultIdentifier(request);
      const id = sanitizeIdentifier(rawId);

      for (const tier of tiers) {
        const key = `${prefix}:${tier.name}:${id}`;
        try {
          const result = await tier.algorithm.evaluate(config.storage, key, Date.now());
          if (!result.allowed) {
            return makeResult(
              false,
              "rate_limited",
              tier.algorithm.limit,
              result.remaining,
              result.reset,
              tier.name
            );
          }
        } catch {
          if (!failOpen) {
            return makeResult(false, "storage_error", tier.algorithm.limit, 0, Date.now() + 1_000, tier.name);
          }
          return makeResult(true, "storage_error", tier.algorithm.limit, tier.algorithm.limit, Date.now() + tier.algorithm.windowMs, tier.name);
        }
      }

      const primaryTier = tiers[0] ?? { name: "default", algorithm: fixedWindow(60, "1m") };
      return makeResult(
        true,
        "ok",
        primaryTier.algorithm.limit,
        primaryTier.algorithm.limit,
        Date.now() + primaryTier.algorithm.windowMs,
        null
      );
    }
  };
}

export { fixedWindow, slidingWindow };
