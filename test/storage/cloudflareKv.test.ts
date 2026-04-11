import { describe, expect, it, vi } from "vitest";
import { cloudflareKV } from "../../src/storage/cloudflare-kv";

describe("cloudflareKV adapter", () => {
  it("validates retries option", () => {
    const binding = {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn()
    };
    expect(() => cloudflareKV({ binding, retries: -1 })).toThrow();
    expect(() => cloudflareKV({ binding, retries: 6 })).toThrow();
  });

  it("gets, sets, increments and deletes values", async () => {
    const binding = {
      get: vi.fn().mockResolvedValueOnce("2").mockResolvedValueOnce("2"),
      put: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined)
    };
    const adapter = cloudflareKV({ binding, prefix: "cf" });

    await expect(adapter.get("k")).resolves.toBe("2");
    await expect(adapter.set("k", "v", 2_500)).resolves.toBeUndefined();
    await expect(adapter.increment("k", 2_500)).resolves.toBe(3);
    await expect(adapter.delete("k")).resolves.toBeUndefined();
  });

  it("handles invalid current increment value", async () => {
    const binding = {
      get: vi.fn().mockResolvedValue("NaN"),
      put: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined)
    };
    const adapter = cloudflareKV({ binding });
    await expect(adapter.increment("counter", 1_000)).resolves.toBe(1);
  });

  it("retries on transient failure", async () => {
    const binding = {
      get: vi
        .fn()
        .mockRejectedValueOnce(new Error("temporary"))
        .mockResolvedValueOnce(null),
      put: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined)
    };
    const adapter = cloudflareKV({ binding, retries: 1 });
    await expect(adapter.get("k")).resolves.toBeNull();
    expect(binding.get).toHaveBeenCalledTimes(2);
  });

  it("rejects empty keys", async () => {
    const binding = {
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined)
    };
    const adapter = cloudflareKV({ binding });
    await expect(adapter.get("   ")).rejects.toThrow("cannot be empty");
  });
});
