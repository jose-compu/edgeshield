import { describe, expect, it, vi } from "vitest";
import { denoKV, type DenoKvLike } from "../../src/storage/deno-kv";

function createMockKv(store = new Map<string, unknown>()): DenoKvLike {
  const keyString = (key: readonly string[]) => key.join(":");

  return {
    async get<T>(key: readonly string[]) {
      const value = store.get(keyString(key));
      return {
        value: (value ?? null) as T | null,
        versionstamp: value === undefined ? null : "v1"
      };
    },
    async set(key: readonly string[], value: unknown) {
      store.set(keyString(key), value);
    },
    async delete(key: readonly string[]) {
      store.delete(keyString(key));
    }
  };
}

describe("denoKV adapter", () => {
  it("validates empty keys", async () => {
    const adapter = denoKV({ kv: createMockKv() });
    await expect(adapter.get("   ")).rejects.toThrow("cannot be empty");
  });

  it("uses custom prefix in kv key paths", async () => {
    const kv = createMockKv();
    const set = vi.spyOn(kv, "set");
    const adapter = denoKV({ kv, prefix: "custom" });
    await adapter.set("user", "1", 1_000);
    expect(set).toHaveBeenCalledWith(["custom", "user"], "1", { expireIn: 1_000 });
  });

  it("treats missing kv entries as null", async () => {
    const adapter = denoKV({ kv: createMockKv() });
    expect(await adapter.get("missing")).toBeNull();
  });

  it("coerces non-numeric increment bases to zero", async () => {
    const store = new Map<string, unknown>([["edgeshield:counter", "NaN"]]);
    const adapter = denoKV({ kv: createMockKv(store) });
    await expect(adapter.increment("counter", 1_000)).resolves.toBe(1);
  });
});
