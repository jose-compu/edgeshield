import { describe, expect, it } from "vitest";
import { presets } from "../../src/presets";
import { memory } from "../../src/storage/memory";

/** Defaults must stay aligned with README preset examples and src/presets. */
const PRESET_DEFAULTS = {
  api: { limit: 100, windowMs: 15 * 60 * 1000 },
  auth: { limit: 5, windowMs: 15 * 60 * 1000 },
  page: { limit: 300, windowMs: 60 * 1000 }
} as const;

describe("preset default limits (README parity)", () => {
  it.each([
    ["api", presets.api] as const,
    ["auth", presets.auth] as const,
    ["page", presets.page] as const
  ])("%s default limit and window match documented values", async (name, factory) => {
    const storage = memory();
    const limiter = factory({ storage });
    const result = await limiter.check(new Request("https://example.com/"));
    expect(result.success).toBe(true);
    expect(result.meta?.limit).toBe(PRESET_DEFAULTS[name].limit);
    const reset = result.meta?.reset;
    expect(typeof reset).toBe("number");
    const windowMs = (reset as number) - Date.now();
    expect(windowMs).toBeGreaterThan(PRESET_DEFAULTS[name].windowMs - 5_000);
    expect(windowMs).toBeLessThanOrEqual(PRESET_DEFAULTS[name].windowMs + 5_000);
  });
});
