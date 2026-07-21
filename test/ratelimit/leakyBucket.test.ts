import { describe, expect, it } from "vitest";
import { memory } from "../../src/storage/memory";
import { leakyBucket } from "../../src/ratelimit/leaky-bucket";

describe("leakyBucket", () => {
  it("accepts requests until capacity then blocks", async () => {
    const storage = memory();
    const algorithm = leakyBucket(2, "1/s");

    const first = await algorithm.evaluate(storage, "user", 1_000);
    const second = await algorithm.evaluate(storage, "user", 1_000);
    const third = await algorithm.evaluate(storage, "user", 1_000);

    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(1);
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(0);
    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
  });

  it("drains level over time and accepts again", async () => {
    const storage = memory();
    const algorithm = leakyBucket(1, "1/s");

    const first = await algorithm.evaluate(storage, "user", 0);
    expect(first.allowed).toBe(true);

    const blocked = await algorithm.evaluate(storage, "user", 100);
    expect(blocked.allowed).toBe(false);

    const drained = await algorithm.evaluate(storage, "user", 1_100);
    expect(drained.allowed).toBe(true);
    expect(drained.remaining).toBe(0);
  });

  it("never goes below empty after long idle", async () => {
    const storage = memory();
    const algorithm = leakyBucket(2, "1/s");

    await algorithm.evaluate(storage, "user", 0);
    const afterIdle = await algorithm.evaluate(storage, "user", 120_000);
    expect(afterIdle.allowed).toBe(true);
    expect(afterIdle.remaining).toBe(1);
  });

  it("handles invalid and partial stored state", async () => {
    const storage = memory();
    const algorithm = leakyBucket(3, "1/s");

    await storage.set("user:leaky", "{bad", 60_000);
    const fromInvalid = await algorithm.evaluate(storage, "user", 1_000);
    expect(fromInvalid.allowed).toBe(true);
    expect(fromInvalid.remaining).toBe(2);

    await storage.set("user:leaky", JSON.stringify({ level: "x" }), 60_000);
    const fromPartial = await algorithm.evaluate(storage, "user", 2_000);
    expect(fromPartial.allowed).toBe(true);
    expect(fromPartial.remaining).toBe(2);
  });

  it("sets reset in the future when denied", async () => {
    const storage = memory();
    const algorithm = leakyBucket(1, "1/s");

    await algorithm.evaluate(storage, "user", 0);
    const denied = await algorithm.evaluate(storage, "user", 0);
    expect(denied.allowed).toBe(false);
    expect(denied.reset).toBeGreaterThan(0);
  });

  it("rejects invalid capacity", () => {
    expect(() => leakyBucket(0, "1/s")).toThrow("positive integer");
    expect(() => leakyBucket(-2, "1/s")).toThrow("positive integer");
  });
});
