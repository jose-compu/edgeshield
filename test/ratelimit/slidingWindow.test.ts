import { describe, expect, it } from "vitest";
import type { StorageAdapter } from "../../src/core/types";
import { slidingWindow } from "../../src/ratelimit/sliding-window";

function createStorage(raw: string | null): StorageAdapter & { written: Array<{ key: string; value: string; ttlMs: number }> } {
  const written: Array<{ key: string; value: string; ttlMs: number }> = [];
  return {
    written,
    async get(): Promise<string | null> {
      return raw;
    },
    async set(key: string, value: string, ttlMs: number): Promise<void> {
      written.push({ key, value, ttlMs });
    },
    async increment(): Promise<number> {
      return 1;
    },
    async delete(): Promise<void> {
      return;
    }
  };
}

describe("slidingWindow", () => {
  it("handles empty state", async () => {
    const algorithm = slidingWindow(2, "10s");
    const storage = createStorage(null);

    const result = await algorithm.evaluate(storage, "k", 1_000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);
    expect(storage.written[0]?.ttlMs).toBe(20_000);
  });

  it("handles invalid json state", async () => {
    const algorithm = slidingWindow(2, "10s");
    const storage = createStorage("{bad json");

    const result = await algorithm.evaluate(storage, "k", 1_000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);
  });

  it("falls back when parsed state fields are missing", async () => {
    const algorithm = slidingWindow(3, "10s");
    const storage = createStorage(JSON.stringify({ currentCount: "x", previousCount: 2 }));

    const result = await algorithm.evaluate(storage, "k", 2_500);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBeGreaterThanOrEqual(0);
  });

  it("rolls window forward and can block", async () => {
    const algorithm = slidingWindow(1, "10s");
    const previousWindowState = {
      currentStartMs: 0,
      currentCount: 2,
      previousStartMs: -10_000,
      previousCount: 0
    };
    const storage = createStorage(JSON.stringify(previousWindowState));

    const result = await algorithm.evaluate(storage, "k", 12_000);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.reset).toBe(20_000);
  });
});
