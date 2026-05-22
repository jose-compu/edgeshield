import { blockedResponse } from "../core/response";

export interface GuardLikeResult {
  success: boolean;
  status: 200 | 403 | 429;
  reason: string;
  headers?: Headers;
  body?: string;
  contentType?: string;
}

export interface GuardLike {
  check(request: Request): Promise<GuardLikeResult>;
}

export interface GuardRunnerOptions {
  onBlocked?: (result: GuardLikeResult) => Response;
}

export function toBlockedResponse(result: GuardLikeResult): Response {
  const status = result.status === 403 ? 403 : 429;
  const bodyOverride =
    result.body && result.contentType
      ? { body: result.body, contentType: result.contentType }
      : undefined;
  return blockedResponse(status, result.reason, result.headers, bodyOverride);
}

export async function runGuards(
  request: Request,
  guards: GuardLike[],
  options?: GuardRunnerOptions
): Promise<Response | null> {
  for (const guard of guards) {
    const result = await guard.check(request);
    if (!result.success) {
      if (options?.onBlocked) {
        return options.onBlocked(result);
      }
      return toBlockedResponse(result);
    }
  }
  return null;
}

export function splitMiddlewareInput(input: Array<GuardLike | GuardRunnerOptions>): {
  guards: GuardLike[];
  options?: GuardRunnerOptions;
} {
  const maybeOptions = input[input.length - 1];
  const hasOptions =
    typeof maybeOptions === "object" &&
    maybeOptions !== null &&
    "onBlocked" in maybeOptions &&
    !("check" in maybeOptions);
  const guards = (hasOptions ? input.slice(0, -1) : input) as GuardLike[];
  if (hasOptions) {
    return { guards, options: maybeOptions };
  }
  return { guards };
}
