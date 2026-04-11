import { fingerprintRequest } from "./fingerprint";
import type { BotRules } from "./rules";
import { evaluateRules } from "./rules";
import { createVdfChallenge, VDF } from "./vdf";

export type BotMode = "detect" | "block";

export interface BotVdfConfig {
  enabled?: boolean;
  steps?: number;
  maxAgeMs?: number;
  challengeHeader?: string;
  solutionHeader?: string;
}

export interface BotGuardConfig {
  mode?: BotMode;
  rules?: BotRules;
  threshold?: number;
  vdf?: BotVdfConfig;
}

export interface BotGuardResult {
  success: boolean;
  status: 200 | 403;
  reason:
    | "passed"
    | "allowlisted_ua"
    | "blocked_ua"
    | "detected_suspicious"
    | "blocked_suspicious"
    | "vdf_challenge_required"
    | "vdf_failed"
    | "vdf_passed";
  score: number;
  headers: Headers;
  meta: {
    signals: string[];
    threshold: number;
  };
}

function result(
  success: boolean,
  status: 200 | 403,
  reason: BotGuardResult["reason"],
  score: number,
  signals: string[],
  threshold: number
): BotGuardResult {
  const headers = new Headers();
  headers.set("X-EdgeShield-Bot-Score", String(score));
  headers.set("X-EdgeShield-Bot-Reason", reason);
  return {
    success,
    status,
    reason,
    score,
    headers,
    meta: {
      signals,
      threshold
    }
  };
}

export function botGuard(config: BotGuardConfig = {}) {
  const mode = config.mode ?? "detect";
  const threshold = config.threshold ?? 60;
  const vdfEnabled = config.vdf?.enabled ?? false;
  const vdfSteps = config.vdf?.steps ?? 20;
  const vdfMaxAgeMs = config.vdf?.maxAgeMs ?? 5 * 60_000;
  const challengeHeader = config.vdf?.challengeHeader ?? "x-edgeshield-vdf-challenge";
  const solutionHeader = config.vdf?.solutionHeader ?? "x-edgeshield-vdf-solution";

  if (threshold <= 0 || threshold > 100) {
    throw new Error("botGuard threshold must be between 1 and 100");
  }
  if (!Number.isInteger(vdfSteps) || vdfSteps <= 0 || vdfSteps > 10_000) {
    throw new Error("botGuard vdf.steps must be between 1 and 10000");
  }
  if (!Number.isFinite(vdfMaxAgeMs) || vdfMaxAgeMs <= 0) {
    throw new Error("botGuard vdf.maxAgeMs must be positive");
  }

  return {
    async check(request: Request): Promise<BotGuardResult> {
      const userAgent = request.headers.get("user-agent") ?? "";
      const ruleDecision = evaluateRules(userAgent, config.rules);
      if (ruleDecision === "allow") {
        return result(true, 200, "allowlisted_ua", 0, ["allowlisted_ua"], threshold);
      }
      if (ruleDecision === "block") {
        if (mode === "block") {
          return result(false, 403, "blocked_ua", 100, ["blocked_ua"], threshold);
        }
        return result(true, 200, "blocked_ua", 100, ["blocked_ua"], threshold);
      }

      const fingerprint = fingerprintRequest(request);
      if (fingerprint.score >= threshold) {
        if (mode === "block") {
          if (vdfEnabled) {
            const encodedChallenge = request.headers.get(challengeHeader);
            const solution = request.headers.get(solutionHeader);

            if (!encodedChallenge || !solution) {
              const challenge = createVdfChallenge();
              const issuedAt = Date.now();
              const challengeValue = `${challenge}.${issuedAt}`;
              const response = result(
                false,
                403,
                "vdf_challenge_required",
                fingerprint.score,
                fingerprint.signals,
                threshold
              );
              response.headers.set(challengeHeader, challengeValue);
              response.headers.set("x-edgeshield-vdf-steps", String(vdfSteps));
              response.headers.set("x-edgeshield-vdf-max-age-ms", String(vdfMaxAgeMs));
              return response;
            }

            const [challengeHex, issuedAtRaw] = encodedChallenge.split(".");
            const issuedAt = Number.parseInt(issuedAtRaw ?? "", 10);
            const expired = !Number.isFinite(issuedAt) || Date.now() - issuedAt > vdfMaxAgeMs;

            if (expired || !challengeHex) {
              const response = result(
                false,
                403,
                "vdf_failed",
                fingerprint.score,
                [...fingerprint.signals, "vdf_expired_or_invalid"],
                threshold
              );
              response.headers.set(challengeHeader, `${createVdfChallenge()}.${Date.now()}`);
              response.headers.set("x-edgeshield-vdf-steps", String(vdfSteps));
              return response;
            }

            let verified = false;
            try {
              verified = await VDF.verify(challengeHex, vdfSteps, solution);
            } catch {
              verified = false;
            }
            if (!verified) {
              const response = result(
                false,
                403,
                "vdf_failed",
                fingerprint.score,
                [...fingerprint.signals, "vdf_verification_failed"],
                threshold
              );
              response.headers.set(challengeHeader, `${createVdfChallenge()}.${Date.now()}`);
              response.headers.set("x-edgeshield-vdf-steps", String(vdfSteps));
              return response;
            }

            return result(
              true,
              200,
              "vdf_passed",
              fingerprint.score,
              [...fingerprint.signals, "vdf_passed"],
              threshold
            );
          }
          return result(false, 403, "blocked_suspicious", fingerprint.score, fingerprint.signals, threshold);
        }
        return result(true, 200, "detected_suspicious", fingerprint.score, fingerprint.signals, threshold);
      }
      return result(true, 200, "passed", fingerprint.score, fingerprint.signals, threshold);
    }
  };
}

export { fingerprintRequest, evaluateRules };
export type { BotRules };
export { VDF, createVdfChallenge };
