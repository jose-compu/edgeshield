import type { DurationString, RateString } from "./types";

const DURATION_RE = /^(\d+)([smhd])$/;
const RATE_RE = /^(\d+)\/([smh])$/;

export function parseDuration(duration: DurationString): number {
  const match = DURATION_RE.exec(duration);
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}`);
  }
  const [, rawValue, unit] = match;
  if (!rawValue || !unit) {
    throw new Error(`Invalid duration format: ${duration}`);
  }
  const value = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Duration must be positive: ${duration}`);
  }
  switch (unit) {
    case "s":
      return value * 1_000;
    case "m":
      return value * 60_000;
    case "h":
      return value * 3_600_000;
    case "d":
      return value * 86_400_000;
    default:
      throw new Error(`Unsupported duration unit: ${unit}`);
  }
}

/** Returns units per millisecond for rates like `"1/s"`, `"10/m"`, `"100/h"`. */
export function parseRate(rate: RateString): number {
  const match = RATE_RE.exec(rate);
  if (!match) {
    throw new Error(`Invalid rate format: ${rate}`);
  }
  const [, rawValue, unit] = match;
  if (!rawValue || !unit) {
    throw new Error(`Invalid rate format: ${rate}`);
  }
  const value = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Rate must be positive: ${rate}`);
  }
  switch (unit) {
    case "s":
      return value / 1_000;
    case "m":
      return value / 60_000;
    case "h":
      return value / 3_600_000;
    default:
      throw new Error(`Unsupported rate unit: ${unit}`);
  }
}

export function unixSeconds(ms: number): number {
  return Math.ceil(ms / 1_000);
}
