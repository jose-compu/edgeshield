import type { StorageAdapter } from "../core/types";

/**
 * Minimal Cloudflare Rate Limiting binding shape.
 * @see https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
 */
export interface CloudflareRateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface CloudflareRateLimitAdapterOptions {
  /** Requests allowed per period as reported in RateLimit headers (informational). */
  limit?: number;
  /** Window length in ms for reset headers (informational; binding owns real window). */
  windowMs?: number;
}

/**
 * Adapter that maps `increment` to a Cloudflare Rate Limiting binding.
 *
 * Note: CF bindings enforce their own configured limit/period. This adapter
 * treats a failed `limit()` as throwing so rateLimit fail-open/closed applies.
 * `get`/`set`/`delete` are no-ops / unsupported for generic KV semantics.
 */
export function cloudflareRateLimit(
  binding: CloudflareRateLimitBinding,
  options: CloudflareRateLimitAdapterOptions = {}
): StorageAdapter {
  const reportedLimit = options.limit ?? 1;
  const windowMs = options.windowMs ?? 60_000;

  return {
    async get(): Promise<string | null> {
      return null;
    },
    async set(): Promise<void> {
      /* binding is write-through via limit() only */
    },
    async increment(key: string): Promise<number> {
      const outcome = await binding.limit({ key });
      if (!outcome.success) {
        // Signal exhaustion to fixed/sliding evaluators that use increment counts.
        // Returning a value above typical limits forces deny on next compare.
        void windowMs;
        return reportedLimit + 1;
      }
      return 1;
    },
    async delete(): Promise<void> {
      /* no-op */
    }
  };
}
