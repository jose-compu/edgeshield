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
  it("api default limit and window match documented values", async () => {
    const result = await presets.api({ storage: memory() }).check(new Request("https://example.com/"));
    expect(result.success).toBe(true);
    expect(result.meta?.limit).toBe(PRESET_DEFAULTS.api.limit);
    const reset = result.meta?.reset;
    expect(typeof reset).toBe("number");
    if (typeof reset !== "number") {
      return;
    }
    const windowMs = reset - Date.now();
    expect(windowMs).toBeGreaterThan(PRESET_DEFAULTS.api.windowMs - 5_000);
    expect(windowMs).toBeLessThanOrEqual(PRESET_DEFAULTS.api.windowMs + 5_000);
  });

  it("auth default limit and window match documented values", async () => {
    const result = await presets.auth({ storage: memory() }).check(new Request("https://example.com/"));
    expect(result.success).toBe(true);
    expect(result.meta?.limit).toBe(PRESET_DEFAULTS.auth.limit);
    const reset = result.meta?.reset;
    expect(typeof reset).toBe("number");
    if (typeof reset !== "number") {
      return;
    }
    const windowMs = reset - Date.now();
    expect(windowMs).toBeGreaterThan(PRESET_DEFAULTS.auth.windowMs - 5_000);
    expect(windowMs).toBeLessThanOrEqual(PRESET_DEFAULTS.auth.windowMs + 5_000);
  });

  it("page default limit and window match documented values", async () => {
    const result = await presets.page({ storage: memory() }).check(new Request("https://example.com/"));
    expect(result.success).toBe(true);
    expect(result.meta?.limit).toBe(PRESET_DEFAULTS.page.limit);
    const reset = result.meta?.reset;
    expect(typeof reset).toBe("number");
    if (typeof reset !== "number") {
      return;
    }
    const windowMs = reset - Date.now();
    expect(windowMs).toBeGreaterThan(PRESET_DEFAULTS.page.windowMs - 5_000);
    expect(windowMs).toBeLessThanOrEqual(PRESET_DEFAULTS.page.windowMs + 5_000);
  });
});
