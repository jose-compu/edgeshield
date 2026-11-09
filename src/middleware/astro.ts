import { runGuards, splitMiddlewareInput, type GuardLike, type GuardRunnerOptions } from "./guard-runner";

export type { GuardLike, GuardLikeResult, GuardRunnerOptions } from "./guard-runner";

/**
 * Astro middleware factory (`onRequest` sequence).
 * Calls `next()` when all guards allow the request.
 */
export function createAstroMiddleware(...input: Array<GuardLike | GuardRunnerOptions>) {
  const { guards, options } = splitMiddlewareInput(input);

  return async function edgeshieldAstroMiddleware(
    context: { request: Request },
    next: () => Promise<Response>
  ): Promise<Response> {
    const blocked = await runGuards(context.request, guards, options);
    if (blocked) {
      return blocked;
    }
    return next();
  };
}
