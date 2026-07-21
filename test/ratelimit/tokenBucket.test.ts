import { describe, expect, it } from "vitest";
import { memory } from "../../src/storage/memory";
import { tokenBucket } from "../../src/ratelimit/token-bucket";

describe("tokenBucket", () => {
  it("starts full and consumes one token per request", async () => {
    const storage = memory();
    const algorithm = tokenBucket(2, "1/s");

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

  it("refills tokens over time", async () => {
    const storage = memory();
    const algorithm = tokenBucket(1, "1/s");

    const first = await algorithm.evaluate(storage, "user", 0);
    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(0);

    const blocked = await algorithm.evaluate(storage, "user", 100);
    expect(blocked.allowed).toBe(false);

    const refilled = await algorithm.evaluate(storage, "user", 1_100);
    expect(refilled.allowed).toBe(true);
    expect(refilled.remaining).toBe(0);
  });

  it("caps refill at capacity", async () => {
    const storage = memory();
    const algorithm = tokenBucket(2, "10/s");

    await algorithm.evaluate(storage, "user", 0);
    await algorithm.evaluate(storage, "user", 0);

    const afterLongIdle = await algorithm.evaluate(storage, "user", 60_000);
    expect(afterLongIdle.allowed).toBe(true);
    expect(afterLongIdle.remaining).toBe(1);
  });

  it("handles invalid and partial stored state", async () => {
    const storage = memory();
    const algorithm = tokenBucket(3, "1/s");

    await storage.set("user:token", "{bad", 60_000);
    const fromInvalid = await algorithm.evaluate(storage, "user", 1_000);
    expect(fromInvalid.allowed).toBe(true);
    expect(fromInvalid.remaining).toBe(2);

    await storage.set("user:token", JSON.stringify({ tokens: "x" }), 60_000);
    const fromPartial = await algorithm.evaluate(storage, "user", 2_000);
    expect(fromPartial.allowed).toBe(true);
    expect(fromPartial.remaining).toBe(2);
  });

  it("sets reset in the future when denied", async () => {
    const storage = memory();
    const algorithm = tokenBucket(1, "1/s");

    await algorithm.evaluate(storage, "user", 0);
    const denied = await algorithm.evaluate(storage, "user", 0);
    expect(denied.allowed).toBe(false);
    expect(denied.reset).toBeGreaterThan(0);
  });

  it("rejects invalid capacity", () => {
    expect(() => tokenBucket(0, "1/s")).toThrow("positive integer");
    expect(() => tokenBucket(1.5, "1/s")).toThrow("positive integer");
  });
});
