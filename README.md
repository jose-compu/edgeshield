# EdgeShield

Edge-native, storage-agnostic rate limiting for modern TypeScript runtimes.

Current release scope: `v0.1.0` includes rate limiting only. Bot detection and CSRF protection are planned roadmap modules.

## Install

```bash
npm install edgeshield
```

## Quick Start

```ts
import { rateLimit, slidingWindow } from "edgeshield/ratelimit";
import { memory } from "edgeshield/storage/memory";

const limiter = rateLimit({
  storage: memory(),
  algorithm: slidingWindow(100, "15m")
});

const result = await limiter.check(request);
if (!result.success) {
  return new Response("Too Many Requests", { status: 429, headers: result.headers });
}
```

## Features in v0.1.0

- Sliding and fixed window algorithms
- Multi-tier rate limiting
- Memory and Upstash adapters
- Next.js middleware helper
- TypeScript-first API

## Comparison

Note: the table reflects the full product vision across roadmap versions, not only what ships in `v0.1.0`.

| Feature | edgeshield | @upstash/ratelimit | rate-limiter-flexible | express-rate-limit |
|---|---|---|---|---|
| Edge-native (no Node APIs) | Yes | Yes | No | No |
| Storage-agnostic | Yes | Upstash only | Redis/Mongo/Postgres | Memory/Redis |
| Rate limiting | Yes (`v0.1.0`) | Yes | Yes | Yes |
| Bot detection | Planned (`v0.2.0`) | No | No | No |
| CSRF protection | Planned (`v0.3.0`) | No | No | No |
| Tree-shakeable subpaths | Yes | No | No | No |
| Zero dependencies | Yes | Needs @upstash/redis | 0 deps (core) | 0 deps |
| Bundle size target | < 4 KB | ~8 KB | ~15 KB | ~5 KB |

## Roadmap

- `v0.1.0` — Core rate limiting + memory + upstash adapters + Next.js middleware
- `v0.2.0` — Bot detection module + Cloudflare KV adapter
- `v0.3.0` — CSRF module + Hono middleware + Vercel KV adapter
- `v0.4.0` — Presets, Deno KV adapter, analytics hooks
- `v1.0.0` — Stable API, full docs site, all adapters battle-tested

## Build And Test

```bash
npm run build
npm run test:coverage
npm run security:audit
```

## Publish

```bash
npm run prepublishOnly
npm publish --access public
```
