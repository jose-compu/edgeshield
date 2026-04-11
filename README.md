# EdgeShield

![EdgeShield logo](./assets/logo.svg)

[![npm version](https://img.shields.io/npm/v/edgeshield.svg)](https://www.npmjs.com/package/edgeshield)
[![CI](https://github.com/jose-compu/edgeshield/actions/workflows/ci.yml/badge.svg)](https://github.com/jose-compu/edgeshield/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/badge/coverage-97%25-brightgreen)](https://github.com/jose-compu/edgeshield)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6.svg)](https://www.typescriptlang.org/)

Edge-native security toolkit for modern TypeScript runtimes.

Current release scope: `v0.3.0` includes rate limiting + bot detection + CSRF protection.

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

## Bot Guard (v0.2.0)

```ts
import { botGuard } from "edgeshield/bot";

const guard = botGuard({
  mode: "block",
  threshold: 60,
  rules: {
    allow: [/googlebot/i, /bingbot/i],
    block: [/curl/i, /python-requests/i, /scrapy/i]
  }
});

const bot = await guard.check(request);
if (!bot.success) {
  return new Response("Forbidden", { status: 403, headers: bot.headers });
}
```

## Sloth VDF Challenge

```ts
import { botGuard, VDF } from "edgeshield/bot";

const guard = botGuard({
  mode: "block",
  threshold: 40,
  vdf: { enabled: true, steps: 20, maxAgeMs: 300000 }
});

const first = await guard.check(request);
if (first.reason === "vdf_challenge_required") {
  const challenge = first.headers.get("x-edgeshield-vdf-challenge");
  const steps = Number(first.headers.get("x-edgeshield-vdf-steps"));
  const challengeHex = challenge?.split(".")[0] ?? "";
  const proof = await VDF.compute(challengeHex, steps);
  // Send challenge + proof headers in the next request:
  // x-edgeshield-vdf-challenge: <challenge>
  // x-edgeshield-vdf-solution: <proof>
}
```

## Cloudflare KV Adapter

```ts
import { cloudflareKV } from "edgeshield/storage/cloudflare-kv";
import { rateLimit, slidingWindow } from "edgeshield/ratelimit";

const storage = cloudflareKV({ binding: env.EDGE_KV, prefix: "edgeshield" });
const limiter = rateLimit({
  storage,
  algorithm: slidingWindow(100, "15m")
});
```

## CSRF Guard (v0.3.0)

```ts
import { csrfGuard } from "edgeshield/csrf";

const csrf = csrfGuard({
  mode: "double-submit",
  secret: process.env.CSRF_SECRET!,
  ttl: "1h",
  ignorePaths: ["/api/webhooks/**"]
});

const token = await csrf.generate(request);
const cookie = csrf.buildCookie(token);

const verify = await csrf.verify(request);
if (!verify.valid) {
  return new Response("Forbidden", { status: 403 });
}
```

## Vercel KV Adapter

```ts
import { vercelKV } from "edgeshield/storage/vercel-kv";

const storage = vercelKV({
  client: kv,
  prefix: "edgeshield"
});
```

## Hono Middleware

```ts
import { Hono } from "hono";
import { edgeshield } from "edgeshield/middleware/hono";
import { rateLimit, slidingWindow } from "edgeshield/ratelimit";
import { botGuard } from "edgeshield/bot";

const app = new Hono();

app.use(
  "/api/*",
  edgeshield(
    rateLimit({ storage, algorithm: slidingWindow(100, "15m") }),
    botGuard({ mode: "block", threshold: 60 })
  )
);
```

## Features in v0.3.0

- Sliding and fixed window algorithms
- Multi-tier rate limiting
- Bot detection (`detect` and `block` modes)
- Sloth VDF challenge support for suspicious bot traffic
- CSRF protection (`double-submit` and `origin-check`)
- Memory, Upstash, Cloudflare KV, and Vercel KV adapters
- Next.js and Hono middleware helpers
- TypeScript-first API

## Comparison

Note: the table reflects the full product vision across roadmap versions.

| Feature | edgeshield | @upstash/ratelimit | rate-limiter-flexible | express-rate-limit |
|---|---|---|---|---|
| Edge-native (no Node APIs) | Yes | Yes | No | No |
| Storage-agnostic | Yes | Upstash only | Redis/Mongo/Postgres | Memory/Redis |
| Rate limiting | Yes (`v0.1.0`) | Yes | Yes | Yes |
| Bot detection | Yes (`v0.2.0`) | No | No | No |
| CSRF protection | Yes (`v0.3.0`) | No | No | No |
| Tree-shakeable subpaths | Yes | No | No | No |
| Zero dependencies | Yes | Needs @upstash/redis | 0 deps (core) | 0 deps |
| Bundle size target | < 4 KB (core ratelimit subpath) | ~8 KB | ~15 KB | ~5 KB |

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

Recommended release flow:

```bash
npm run lint
npm run typecheck
npm run test:coverage
npm run build
npm pack --dry-run
```
