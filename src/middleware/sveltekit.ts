import { runGuards, splitMiddlewareInput, type GuardLike, type GuardRunnerOptions } from "./guard-runner";

export type { GuardLike, GuardLikeResult, GuardRunnerOptions } from "./guard-runner";

/**
 * SvelteKit-style handle helper.
 * Return value is a blocked Response, or `null` to continue the chain.
 */
export function createSvelteKitHandle(...input: Array<GuardLike | GuardRunnerOptions>) {
  const { guards, options } = splitMiddlewareInput(input);

  return async function edgeshieldSvelteKitHandle({
    event,
    resolve
  }: {
    event: { request: Request };
    resolve: (event: { request: Request }) => Promise<Response>;
  }): Promise<Response> {
    const blocked = await runGuards(event.request, guards, options);
    if (blocked) {
      return blocked;
    }
    return resolve(event);
  };
}
