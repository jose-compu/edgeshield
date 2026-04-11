import { blockedResponse } from "../core/response";

export interface HonoGuardLikeResult {
  success: boolean;
  status: 200 | 403 | 429;
  reason: string;
  headers?: Headers;
}

export interface HonoGuardLike {
  check(request: Request): Promise<HonoGuardLikeResult>;
}

interface HonoLikeContext {
  req: { raw: Request };
  newResponse(body: BodyInit | null, status?: number, headers?: HeadersInit): Response;
}

type HonoNext = () => Promise<void>;

export function edgeshield(...guards: HonoGuardLike[]) {
  return async function edgeshieldHonoMiddleware(
    context: HonoLikeContext,
    next: HonoNext
  ): Promise<void | Response> {
    for (const guard of guards) {
      const result = await guard.check(context.req.raw);
      if (!result.success) {
        const status = result.status === 403 ? 403 : 429;
        const blocked = blockedResponse(status, result.reason, result.headers);
        return context.newResponse(blocked.body, blocked.status, blocked.headers);
      }
    }
    await next();
  };
}
