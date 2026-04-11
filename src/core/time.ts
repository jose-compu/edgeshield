import type { DurationString } from "./types";

const DURATION_RE = /^(\d+)([smhd])$/;

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
      throw new Error(`Unsupported duration unit: ${unit as string}`);
  }
}

export function unixSeconds(ms: number): number {
  return Math.ceil(ms / 1_000);
}
