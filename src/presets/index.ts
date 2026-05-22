import { botGuard, type BotGuardConfig, type BotMode } from "../bot";
import { csrfGuard, type CsrfGuardConfig } from "../csrf";
import type { StorageAdapter } from "../core/types";
import type { GuardLike } from "../middleware/guard-runner";
import { rateLimit, slidingWindow } from "../ratelimit";

interface PresetInput {
  storage: StorageAdapter;
  prefix?: string;
}

interface ApiPresetInput extends PresetInput {
  limit?: number;
  window?: `${number}${"s" | "m" | "h" | "d"}`;
}

type BotPresetConfig = Omit<BotGuardConfig, "mode"> & { mode?: BotMode };
type CsrfPresetConfig = Omit<CsrfGuardConfig, "secret">;

interface ApiShieldInput extends ApiPresetInput {
  bot?: BotPresetConfig | false;
  csrf?: CsrfPresetConfig;
  csrfSecret?: string;
}

interface AuthShieldInput extends ApiPresetInput {
  bot?: BotPresetConfig | false;
  csrf?: CsrfPresetConfig;
  csrfSecret: string;
}

interface PageShieldInput extends ApiPresetInput {
  bot?: BotPresetConfig | false;
}

function compositeGuard(...guards: GuardLike[]): GuardLike {
  return {
    async check(request: Request) {
      for (const guard of guards) {
        const result = await guard.check(request);
        if (!result.success) {
          return result;
        }
      }
      return {
        success: true,
        status: 200 as const,
        reason: "ok",
        headers: new Headers()
      };
    }
  };
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
  },
  apiShield(input: ApiShieldInput) {
    const guards: GuardLike[] = [presets.api(input)];
    if (input.bot !== false) {
      guards.push(
        botGuard({
          mode: "block",
          threshold: 60,
          storage: input.storage,
          ...input.bot
        })
      );
    }
    if (input.csrfSecret) {
      guards.push(
        csrfGuard({
          secret: input.csrfSecret,
          ...input.csrf
        })
      );
    }
    return compositeGuard(...guards);
  },
  authShield(input: AuthShieldInput) {
    const guards: GuardLike[] = [
      presets.auth(input),
      ...(input.bot !== false
        ? [
            botGuard({
              mode: "block",
              threshold: 40,
              storage: input.storage,
              ...input.bot
            })
          ]
        : []),
      csrfGuard({
        secret: input.csrfSecret,
        ...input.csrf
      })
    ];
    return compositeGuard(...guards);
  },
  pageShield(input: PageShieldInput) {
    const guards: GuardLike[] = [
      presets.page(input),
      ...(input.bot !== false
        ? [
            botGuard({
              mode: "detect",
              threshold: 60,
              storage: input.storage,
              ...input.bot
            })
          ]
        : [])
    ];
    return compositeGuard(...guards);
  }
};

export type {
  ApiPresetInput,
  ApiShieldInput,
  AuthShieldInput,
  PageShieldInput,
  PresetInput
};
