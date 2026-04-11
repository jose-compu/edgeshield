import { describe, expect, it } from "vitest";
import { parseDuration } from "../../src/core/time";
import { fixedWindow } from "../../src/ratelimit/fixed-window";
import { slidingWindow } from "../../src/ratelimit/sliding-window";

describe("algorithm and parser validation", () => {
  it("parses durations", () => {
    expect(parseDuration("10s")).toBe(10_000);
    expect(parseDuration("2m")).toBe(120_000);
    expect(parseDuration("1h")).toBe(3_600_000);
    expect(parseDuration("1d")).toBe(86_400_000);
  });

  it("throws for invalid duration", () => {
    expect(() => parseDuration("0s")).toThrow();
    expect(() => parseDuration("5x" as never)).toThrow();
  });

  it("throws for invalid limits", () => {
    expect(() => fixedWindow(0, "1m")).toThrow();
    expect(() => slidingWindow(-1, "1m")).toThrow();
  });
});
