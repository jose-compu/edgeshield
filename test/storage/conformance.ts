import { beforeEach, describe, expect, it } from "vitest";
import type { StorageAdapter } from "../../src/core/types";

type AdapterFactory = () => StorageAdapter | Promise<StorageAdapter>;

export function describeStorageAdapterConformance(name: string, factory: AdapterFactory): void {
  describe(`storage conformance (${name})`, () => {
    let adapter: StorageAdapter;

    beforeEach(async () => {
      adapter = await factory();
    });

    it("returns null for missing keys", async () => {
      expect(await adapter.get("missing-key")).toBeNull();
    });

    it("sets and gets values", async () => {
      await adapter.set("item", "value", 60_000);
      expect(await adapter.get("item")).toBe("value");
    });

    it("overwrites existing values", async () => {
      await adapter.set("item", "first", 60_000);
      await adapter.set("item", "second", 60_000);
      expect(await adapter.get("item")).toBe("second");
    });

    it("deletes values", async () => {
      await adapter.set("item", "value", 60_000);
      await adapter.delete("item");
      expect(await adapter.get("item")).toBeNull();
    });

    it("increments from zero and continues counting", async () => {
      expect(await adapter.increment("counter", 60_000)).toBe(1);
      expect(await adapter.increment("counter", 60_000)).toBe(2);
      expect(await adapter.get("counter")).toBe("2");
    });

    it("increments after an existing set value", async () => {
      await adapter.set("counter", "4", 60_000);
      expect(await adapter.increment("counter", 60_000)).toBe(5);
    });

    it("uses isolated keys per test run prefix", async () => {
      await adapter.set("isolated", "ok", 60_000);
      expect(await adapter.get("isolated")).toBe("ok");
    });
  });
}
