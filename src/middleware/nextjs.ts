import { blockedResponse } from "../core/response";

export interface GuardLikeResult {
  success: boolean;
  status: 200 | 403 | 429;
  reason: string;
  headers?: Headers;
}

export interface GuardLike {
  check(request: Request): Promise<GuardLikeResult>;
}

export interface MiddlewareOptions {
  onBlocked?: (result: GuardLikeResult) => Response;
}

export function createMiddleware(...input: Array<GuardLike | MiddlewareOptions>) {
  const maybeOptions = input[input.length - 1];
  const hasOptions =
    typeof maybeOptions === "object" &&
    maybeOptions !== null &&
    "onBlocked" in maybeOptions &&
    !("check" in maybeOptions);
  const options: MiddlewareOptions | undefined = hasOptions ? maybeOptions : undefined;
  const guards = (hasOptions ? input.slice(0, -1) : input) as GuardLike[];

  return async function edgeshieldNextMiddleware(request: Request): Promise<Response | undefined> {
    for (const guard of guards) {
      const result = await guard.check(request);
      if (!result.success) {
        if (options?.onBlocked) {
          return options.onBlocked(result);
        }
        const status = result.status === 403 ? 403 : 429;
        return blockedResponse(status, result.reason, result.headers);
      }
    }
    return undefined;
  };
}
