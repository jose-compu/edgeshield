import { describe, expect, it, vi } from "vitest";
import { vercelKV } from "../../src/storage/vercel-kv";

describe("vercelKV adapter", () => {
  it("rejects empty keys", async () => {
    const client = {
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
      incr: vi.fn()
    };
    const adapter = vercelKV({ client });
    await expect(adapter.get(" ")).rejects.toThrow("cannot be empty");
  });

  it("supports get/set/delete", async () => {
    const client = {
      get: vi.fn().mockResolvedValue("1"),
      set: vi.fn().mockResolvedValue("OK"),
      del: vi.fn().mockResolvedValue(1),
      incr: vi.fn().mockResolvedValue(2)
    };
    const adapter = vercelKV({ client, prefix: "es" });
    await expect(adapter.get("k")).resolves.toBe("1");
    await expect(adapter.set("k", "v", 1_000)).resolves.toBeUndefined();
    await expect(adapter.delete("k")).resolves.toBeUndefined();
  });

  it("increments with pexpire when available", async () => {
    const client = {
      get: vi.fn().mockResolvedValue("2"),
      set: vi.fn().mockResolvedValue("OK"),
      del: vi.fn().mockResolvedValue(1),
      incr: vi.fn().mockResolvedValue(3),
      pexpire: vi.fn().mockResolvedValue(1)
    };
    const adapter = vercelKV({ client });
    await expect(adapter.increment("counter", 2_000)).resolves.toBe(3);
    expect(client.pexpire).toHaveBeenCalledTimes(1);
  });

  it("falls back to set ttl when pexpire is unavailable", async () => {
    const client = {
      get: vi.fn().mockResolvedValue("4"),
      set: vi.fn().mockResolvedValue("OK"),
      del: vi.fn().mockResolvedValue(1),
      incr: vi.fn().mockResolvedValue(5)
    };
    const adapter = vercelKV({ client });
    await expect(adapter.increment("counter", 2_000)).resolves.toBe(5);
    expect(client.set).toHaveBeenCalled();
  });

  it("does not set ttl fallback when key disappears", async () => {
    const client = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue("OK"),
      del: vi.fn().mockResolvedValue(1),
      incr: vi.fn().mockResolvedValue(1)
    };
    const adapter = vercelKV({ client });
    await expect(adapter.increment("counter", 2_000)).resolves.toBe(1);
    expect(client.set).not.toHaveBeenCalled();
  });
});
