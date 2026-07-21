import { describe, expect, it } from "vitest";
import { parseDuration, parseRate } from "../../src/core/time";
import { fixedWindow } from "../../src/ratelimit/fixed-window";
import { leakyBucket } from "../../src/ratelimit/leaky-bucket";
import { slidingWindow } from "../../src/ratelimit/sliding-window";
import { tokenBucket } from "../../src/ratelimit/token-bucket";

describe("algorithm and parser validation", () => {
  it("parses durations", () => {
    expect(parseDuration("10s")).toBe(10_000);
    expect(parseDuration("2m")).toBe(120_000);
    expect(parseDuration("1h")).toBe(3_600_000);
    expect(parseDuration("1d")).toBe(86_400_000);
  });

  it("parses rates", () => {
    expect(parseRate("1/s")).toBeCloseTo(0.001);
    expect(parseRate("10/m")).toBeCloseTo(10 / 60_000);
    expect(parseRate("100/h")).toBeCloseTo(100 / 3_600_000);
  });

  it("throws for invalid duration", () => {
    expect(() => parseDuration("0s")).toThrow();
    expect(() => parseDuration("5x" as never)).toThrow();
  });

  it("throws for invalid rate", () => {
    expect(() => parseRate("0/s")).toThrow();
    expect(() => parseRate("1/d" as never)).toThrow();
    expect(() => parseRate("1s" as never)).toThrow();
  });

  it("throws for invalid limits", () => {
    expect(() => fixedWindow(0, "1m")).toThrow();
    expect(() => slidingWindow(-1, "1m")).toThrow();
    expect(() => tokenBucket(0, "1/s")).toThrow();
    expect(() => leakyBucket(-1, "10/m")).toThrow();
  });
});
