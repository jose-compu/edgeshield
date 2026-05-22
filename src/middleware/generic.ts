import {
  runGuards,
  splitMiddlewareInput,
  type GuardLike,
  type GuardRunnerOptions
} from "./guard-runner";

export type { GuardLike, GuardLikeResult, GuardRunnerOptions } from "./guard-runner";
export { runGuards, toBlockedResponse } from "./guard-runner";

export function shield(...input: Array<GuardLike | GuardRunnerOptions>) {
  const { guards, options } = splitMiddlewareInput(input);

  return async function protect(request: Request): Promise<Response | null> {
    return runGuards(request, guards, options);
  };
}

/** Alias for frameworks that expect a named middleware factory. */
export const createGenericMiddleware = shield;
