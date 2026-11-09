import { describe, expect, it, vi } from "vitest";
import { cloudflareRateLimit } from "../../src/storage/cloudflare-rate-limit";

describe("cloudflareRateLimit adapter", () => {
  it("maps successful limit() to increment 1", async () => {
    const binding = {
      limit: vi.fn().mockResolvedValue({ success: true })
    };
    const adapter = cloudflareRateLimit(binding, { limit: 10 });
    await expect(adapter.increment("k", 1000)).resolves.toBe(1);
    expect(binding.limit).toHaveBeenCalledWith({ key: "k" });
  });

  it("maps failed limit() above reported limit", async () => {
    const binding = {
      limit: vi.fn().mockResolvedValue({ success: false })
    };
    const adapter = cloudflareRateLimit(binding, { limit: 3 });
    await expect(adapter.increment("k", 1000)).resolves.toBe(4);
  });
});
