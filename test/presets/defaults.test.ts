import { describe, expect, it } from "vitest";
import { presets } from "../../src/presets";
import { memory } from "../../src/storage/memory";

/** Defaults must stay aligned with README preset examples and src/presets. */
const PRESET_DEFAULTS = {
  api: { limit: 100, windowMs: 15 * 60 * 1000 },
  auth: { limit: 5, windowMs: 15 * 60 * 1000 },
  page: { limit: 300, windowMs: 60 * 1000 }
} as const;

type PresetName = keyof typeof PRESET_DEFAULTS;

async function assertPresetDefaults(name: PresetName): Promise<void> {
  const storage = memory();
  const factory =
    name === "api" ? presets.api : name === "auth" ? presets.auth : presets.page;
  const limiter = factory({ storage });
  const result = await limiter.check(new Request("https://example.com/"));
  expect(result.success).toBe(true);
  expect(result.meta?.limit).toBe(PRESET_DEFAULTS[name].limit);
  const reset = result.meta?.reset;
  expect(typeof reset).toBe("number");
  if (typeof reset !== "number") {
    return;
  }
  const windowMs = reset - Date.now();
  expect(windowMs).toBeGreaterThan(PRESET_DEFAULTS[name].windowMs - 5_000);
  expect(windowMs).toBeLessThanOrEqual(PRESET_DEFAULTS[name].windowMs + 5_000);
}

describe("preset default limits (README parity)", () => {
  it("api default limit and window match documented values", async () => {
    await assertPresetDefaults("api");
  });

  it("auth default limit and window match documented values", async () => {
    await assertPresetDefaults("auth");
  });

  it("page default limit and window match documented values", async () => {
    await assertPresetDefaults("page");
  });
});
