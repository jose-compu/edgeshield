import type { StorageAdapter } from "../core/types";
import { rateLimit, slidingWindow } from "../ratelimit";

interface PresetInput {
  storage: StorageAdapter;
  prefix?: string;
}

interface ApiPresetInput extends PresetInput {
  limit?: number;
  window?: `${number}${"s" | "m" | "h" | "d"}`;
}

export const presets = {
  api(input: ApiPresetInput) {
    return rateLimit({
      storage: input.storage,
      prefix: input.prefix ?? "edgeshield:api",
      algorithm: slidingWindow(input.limit ?? 100, input.window ?? "15m")
    });
  },
  auth(input: ApiPresetInput) {
    return rateLimit({
      storage: input.storage,
      prefix: input.prefix ?? "edgeshield:auth",
      algorithm: slidingWindow(input.limit ?? 5, input.window ?? "15m")
    });
  },
  page(input: ApiPresetInput) {
    return rateLimit({
      storage: input.storage,
      prefix: input.prefix ?? "edgeshield:page",
      algorithm: slidingWindow(input.limit ?? 300, input.window ?? "1m")
    });
  }
};
