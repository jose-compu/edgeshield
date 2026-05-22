import { runGuards, splitMiddlewareInput, type GuardLike, type GuardRunnerOptions } from "./guard-runner";

export type { GuardLike, GuardLikeResult, GuardRunnerOptions } from "./guard-runner";

export function createMiddleware(...input: Array<GuardLike | GuardRunnerOptions>) {
  const { guards, options } = splitMiddlewareInput(input);

  return async function edgeshieldNextMiddleware(request: Request): Promise<Response | undefined> {
    const blocked = await runGuards(request, guards, options);
    return blocked ?? undefined;
  };
}
