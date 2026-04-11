import { parseDuration } from "../core/time";
import type { DurationString } from "../core/types";
import {
  buildCsrfCookie,
  generateDoubleSubmitToken,
  type CsrfCookieOptions,
  verifyDoubleSubmitToken
} from "./double-submit";
import { verifyOrigin } from "./origin-check";

export type CsrfMode = "double-submit" | "origin-check";
export type CsrfReason = "missing_token" | "expired" | "mismatch" | "origin_mismatch" | "valid";

export interface CsrfGuardConfig {
  mode?: CsrfMode;
  secret: string;
  ttl?: DurationString;
  cookie?: CsrfCookieOptions;
  ignorePaths?: string[];
}

export interface CsrfVerifyResult {
  valid: boolean;
  reason: CsrfReason;
}

export interface CsrfGuardResult {
  success: boolean;
  status: 200 | 403;
  reason: CsrfReason;
  headers: Headers;
}

function methodNeedsCsrf(method: string): boolean {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase());
}

function pathIgnored(pathname: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    if (pattern.endsWith("/**")) {
      return pathname.startsWith(pattern.slice(0, -3));
    }
    return pathname === pattern;
  });
}

export function csrfGuard(config: CsrfGuardConfig) {
  if (!config.secret || config.secret.length < 16) {
    throw new Error("csrfGuard secret must be at least 16 characters");
  }
  const mode = config.mode ?? "double-submit";
  const ttlMs = parseDuration(config.ttl ?? "1h");
  const cookie: CsrfCookieOptions = {
    name: config.cookie?.name ?? "__csrf",
    sameSite: config.cookie?.sameSite ?? "strict",
    secure: config.cookie?.secure ?? true,
    httpOnly: config.cookie?.httpOnly ?? true,
    path: config.cookie?.path ?? "/"
  };
  const ignorePaths = config.ignorePaths ?? [];

  const verifyRequest = async (request: Request): Promise<CsrfVerifyResult> => {
    const url = new URL(request.url);
    if (!methodNeedsCsrf(request.method) || pathIgnored(url.pathname, ignorePaths)) {
      return { valid: true, reason: "valid" };
    }
    if (mode === "origin-check") {
      const reason = verifyOrigin(request);
      return { valid: reason === "valid", reason };
    }
    const reason = await verifyDoubleSubmitToken(request, config.secret, cookie.name);
    return { valid: reason === "valid", reason };
  };

  return {
    async generate(request: Request): Promise<string> {
      void request;
      return generateDoubleSubmitToken(config.secret, ttlMs);
    },
    verify: verifyRequest,
    async check(request: Request): Promise<CsrfGuardResult> {
      const verify = await verifyRequest(request);
      const headers = new Headers();
      if (!verify.valid) {
        return { success: false, status: 403, reason: verify.reason, headers };
      }
      return { success: true, status: 200, reason: "valid", headers };
    },
    buildCookie(token: string): string {
      return buildCsrfCookie(token, cookie, ttlMs);
    }
  };
}

export { verifyOrigin };
