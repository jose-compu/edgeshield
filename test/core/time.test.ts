import { describe, expect, it } from "vitest";
import { parseDuration, parseRate, unixSeconds } from "../../src/core/time";
import type { DurationString, RateString } from "../../src/core/types";

describe("time helpers", () => {
  it("parses supported duration units", () => {
    expect(parseDuration("10s")).toBe(10_000);
    expect(parseDuration("5m")).toBe(300_000);
    expect(parseDuration("2h")).toBe(7_200_000);
    expect(parseDuration("1d")).toBe(86_400_000);
  });

  it("rejects invalid duration strings", () => {
    expect(() => parseDuration("10x" as DurationString)).toThrow("Invalid duration format");
    expect(() => parseDuration("0s" as DurationString)).toThrow("Duration must be positive");
    expect(() => parseDuration("" as DurationString)).toThrow("Invalid duration format");
  });

  it("parses supported rate units", () => {
    expect(parseRate("1/s")).toBeCloseTo(0.001);
    expect(parseRate("60/m")).toBeCloseTo(0.001);
    expect(parseRate("3600/h")).toBeCloseTo(0.001);
  });

  it("rejects invalid rate strings", () => {
    expect(() => parseRate("1/d" as RateString)).toThrow("Invalid rate format");
    expect(() => parseRate("0/s" as RateString)).toThrow("Rate must be positive");
    expect(() => parseRate("1s" as RateString)).toThrow("Invalid rate format");
  });

  it("converts milliseconds to unix seconds", () => {
    expect(unixSeconds(1_500)).toBe(2);
    expect(unixSeconds(0)).toBe(0);
  });
});
