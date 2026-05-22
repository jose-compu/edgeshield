import type { StorageAdapter } from "../core/types";
import {
  issueChallengeValue,
  parseEncodedChallenge,
  renderChallengePage,
  verifyVdfSolution,
  type ChallengeRenderer
} from "./challenge";
import { fingerprintRequest } from "./fingerprint";
import type { BotRules } from "./rules";
import { evaluateRules } from "./rules";

export type BotMode = "detect" | "block" | "challenge";

export interface BotVdfConfig {
  enabled?: boolean;
  steps?: number;
  maxAgeMs?: number;
  challengeHeader?: string;
  solutionHeader?: string;
}

export interface BotChallengeConfig {
  renderer?: ChallengeRenderer;
}

export interface BotGuardConfig {
  mode?: BotMode;
  rules?: BotRules;
  threshold?: number;
  vdf?: BotVdfConfig;
  challenge?: BotChallengeConfig;
  storage?: StorageAdapter;
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
    | "vdf_passed"
    | "challenge_required"
    | "challenge_failed"
    | "challenge_passed";
  score: number;
  headers: Headers;
  body?: string;
  contentType?: string;
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
  threshold: number,
  extra?: Pick<BotGuardResult, "body" | "contentType">
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
    ...extra,
    meta: {
      signals,
      threshold
    }
  };
}

function setVdfChallengeHeaders(
  headers: Headers,
  encoded: string,
  steps: number,
  maxAgeMs: number,
  challengeHeader: string
): void {
  headers.set(challengeHeader, encoded);
  headers.set("x-edgeshield-vdf-steps", String(steps));
  headers.set("x-edgeshield-vdf-max-age-ms", String(maxAgeMs));
}

export function botGuard(config: BotGuardConfig = {}) {
  const mode = config.mode ?? "detect";
  const threshold = config.threshold ?? 60;
  const vdfEnabled = mode === "challenge" ? (config.vdf?.enabled ?? true) : (config.vdf?.enabled ?? false);
  const vdfSteps = config.vdf?.steps ?? 20;
  const vdfMaxAgeMs = config.vdf?.maxAgeMs ?? 5 * 60_000;
  const challengeHeader = config.vdf?.challengeHeader ?? "x-edgeshield-vdf-challenge";
  const solutionHeader = config.vdf?.solutionHeader ?? "x-edgeshield-vdf-solution";
  const challengeRenderer = config.challenge?.renderer;
  const storage = config.storage;

  if (threshold <= 0 || threshold > 100) {
    throw new Error("botGuard threshold must be between 1 and 100");
  }
  if (!Number.isInteger(vdfSteps) || vdfSteps <= 0 || vdfSteps > 10_000) {
    throw new Error("botGuard vdf.steps must be between 1 and 10000");
  }
  if (!Number.isFinite(vdfMaxAgeMs) || vdfMaxAgeMs <= 0) {
    throw new Error("botGuard vdf.maxAgeMs must be positive");
  }

  async function handleVdfFlow(
    request: Request,
    fingerprint: ReturnType<typeof fingerprintRequest>,
    options: { htmlChallenge: boolean; challengeReason: "vdf_challenge_required" | "challenge_required" }
  ): Promise<BotGuardResult> {
    const encodedChallenge = request.headers.get(challengeHeader);
    const solution = request.headers.get(solutionHeader);

    if (!encodedChallenge || !solution) {
      const issued = issueChallengeValue();
      const response = result(
        false,
        403,
        options.challengeReason,
        fingerprint.score,
        fingerprint.signals,
        threshold
      );
      setVdfChallengeHeaders(response.headers, issued.encoded, vdfSteps, vdfMaxAgeMs, challengeHeader);

      if (options.htmlChallenge) {
        const page = renderChallengePage(
          {
            request,
            challengeHex: issued.challengeHex,
            issuedAt: issued.issuedAt,
            steps: vdfSteps,
            maxAgeMs: vdfMaxAgeMs,
            score: fingerprint.score,
            challengeHeader,
            solutionHeader
          },
          challengeRenderer
        );
        response.body = page.body;
        response.contentType = page.contentType;
        response.headers.set("content-type", page.contentType);
      }

      return response;
    }

    const parsed = parseEncodedChallenge(encodedChallenge, vdfMaxAgeMs);
    if (parsed.expired || !parsed.valid) {
      const issued = issueChallengeValue();
      const response = result(
        false,
        403,
        options.htmlChallenge ? "challenge_failed" : "vdf_failed",
        fingerprint.score,
        [...fingerprint.signals, "vdf_expired_or_invalid"],
        threshold
      );
      setVdfChallengeHeaders(response.headers, issued.encoded, vdfSteps, vdfMaxAgeMs, challengeHeader);

      if (options.htmlChallenge) {
        const page = renderChallengePage(
          {
            request,
            challengeHex: issued.challengeHex,
            issuedAt: issued.issuedAt,
            steps: vdfSteps,
            maxAgeMs: vdfMaxAgeMs,
            score: fingerprint.score,
            challengeHeader,
            solutionHeader
          },
          challengeRenderer
        );
        response.body = page.body;
        response.contentType = page.contentType;
        response.headers.set("content-type", page.contentType);
      }

      return response;
    }

    const verified = await verifyVdfSolution(
      parsed.challengeHex,
      vdfSteps,
      solution,
      storage,
      vdfMaxAgeMs
    );

    if (!verified) {
      const issued = issueChallengeValue();
      const response = result(
        false,
        403,
        options.htmlChallenge ? "challenge_failed" : "vdf_failed",
        fingerprint.score,
        [...fingerprint.signals, "vdf_verification_failed"],
        threshold
      );
      setVdfChallengeHeaders(response.headers, issued.encoded, vdfSteps, vdfMaxAgeMs, challengeHeader);

      if (options.htmlChallenge) {
        const page = renderChallengePage(
          {
            request,
            challengeHex: issued.challengeHex,
            issuedAt: issued.issuedAt,
            steps: vdfSteps,
            maxAgeMs: vdfMaxAgeMs,
            score: fingerprint.score,
            challengeHeader,
            solutionHeader
          },
          challengeRenderer
        );
        response.body = page.body;
        response.contentType = page.contentType;
        response.headers.set("content-type", page.contentType);
      }

      return response;
    }

    return result(
      true,
      200,
      options.htmlChallenge ? "challenge_passed" : "vdf_passed",
      fingerprint.score,
      [...fingerprint.signals, options.htmlChallenge ? "challenge_passed" : "vdf_passed"],
      threshold
    );
  }

  return {
    async check(request: Request): Promise<BotGuardResult> {
      const userAgent = request.headers.get("user-agent") ?? "";
      const ruleDecision = evaluateRules(userAgent, config.rules);
      if (ruleDecision === "allow") {
        return result(true, 200, "allowlisted_ua", 0, ["allowlisted_ua"], threshold);
      }
      if (ruleDecision === "block") {
        if (mode === "block" || mode === "challenge") {
          return result(false, 403, "blocked_ua", 100, ["blocked_ua"], threshold);
        }
        return result(true, 200, "blocked_ua", 100, ["blocked_ua"], threshold);
      }

      const fingerprint = fingerprintRequest(request);
      if (fingerprint.score >= threshold) {
        if (mode === "challenge" && vdfEnabled) {
          return handleVdfFlow(request, fingerprint, {
            htmlChallenge: true,
            challengeReason: "challenge_required"
          });
        }
        if (mode === "block") {
          if (vdfEnabled) {
            return handleVdfFlow(request, fingerprint, {
              htmlChallenge: false,
              challengeReason: "vdf_challenge_required"
            });
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
export type { BotRules, ChallengeRenderer };
export { VDF, createVdfChallenge } from "./vdf";
export {
  defaultChallengeRenderer,
  renderChallengePage,
  parseEncodedChallenge,
  issueChallengeValue
} from "./challenge";
