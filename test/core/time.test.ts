import { describe, expect, it } from "vitest";
import { parseDuration, unixSeconds } from "../../src/core/time";
import type { DurationString } from "../../src/core/types";

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

  it("converts milliseconds to unix seconds", () => {
    expect(unixSeconds(1_500)).toBe(2);
    expect(unixSeconds(0)).toBe(0);
  });
});
