import { runGuards, toBlockedResponse, type GuardLike } from "./guard-runner";

export type { GuardLike, GuardLikeResult } from "./guard-runner";

interface HonoLikeContext {
  req: { raw: Request };
  newResponse(body: BodyInit | null, status?: number, headers?: HeadersInit): Response;
}

type HonoNext = () => Promise<void>;

export function edgeshield(...guards: GuardLike[]) {
  return async function edgeshieldHonoMiddleware(
    context: HonoLikeContext,
    next: HonoNext
  ): Promise<void | Response> {
    const blocked = await runGuards(context.req.raw, guards);
    if (blocked) {
      return context.newResponse(blocked.body, blocked.status, blocked.headers);
    }
    await next();
  };
}

export { toBlockedResponse };
