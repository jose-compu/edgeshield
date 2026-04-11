# EdgeShield

**Edge-native rate limiting, bot detection, and CSRF protection for modern TypeScript runtimes.**

`npm install edgeshield`

---

## Why this exists

The current landscape has two problems:

1. **Vendor lock-in.** `@upstash/ratelimit` is good but requires Upstash Redis. Cloudflare has its own rate limiting API. Vercel KV has its own patterns. You pick one and you're stuck.
2. **Fragmented concerns.** Rate limiting, bot detection, and CSRF are three separate packages today, but they're all "should I allow this request?" decisions that belong in the same middleware layer.

EdgeShield is a single, tiny package that handles all three with a pluggable storage backend — no vendor dependency baked in.

---

## Package name

**`edgeshield`**

- Short, memorable, descriptive.
- Available on npm (verified April 2026).
- Namespace: no `@org/` prefix needed — keep it simple for adoption.

---

## Design principles

1. **Zero Node.js APIs.** Only Web Standard APIs (`Request`, `Response`, `crypto.subtle`, `TextEncoder`). Runs on Cloudflare Workers, Vercel Edge, Deno Deploy, Bun, Fastly, Netlify Edge, Lagon — anywhere with `fetch`.
2. **Storage-agnostic.** Ship adapters for Upstash Redis, Cloudflare KV, Vercel KV, Deno KV, and plain `Map` (for dev/single-instance). Users can write their own in ~20 lines.
3. **Tree-shakeable.** Each concern (rate limit, bot, CSRF) is an independent import. Bundle only what you use.
4. **Tiny.** Target < 4 KB minified+gzipped for the core. No dependencies.
5. **TypeScript-first.** Written in TypeScript, ships `.d.ts`, full inference on config objects.

---

## Architecture

```
edgeshield/
├── core/
│   ├── types.ts          # Shared types, StorageAdapter interface
│   ├── response.ts       # Standard response helpers (429, 403, headers)
│   └── identity.ts       # Request identity extraction (IP, key, fingerprint)
│
├── ratelimit/
│   ├── index.ts          # rateLimit() — main export
│   ├── sliding-window.ts # Sliding window counter algorithm
│   ├── fixed-window.ts   # Fixed window counter algorithm
│   ├── token-bucket.ts   # Token bucket algorithm
│   └── leaky-bucket.ts   # Leaky bucket algorithm
│
├── bot/
│   ├── index.ts          # botGuard() — main export
│   ├── fingerprint.ts    # TLS/header fingerprinting heuristics
│   ├── challenge.ts      # JS challenge generation (proof-of-work)
│   └── rules.ts          # User-agent / header pattern rules
│
├── csrf/
│   ├── index.ts          # csrfGuard() — main export
│   ├── double-submit.ts  # Double-submit cookie pattern
│   └── origin-check.ts   # Origin/Referer header validation
│
├── storage/
│   ├── memory.ts         # Map-based (dev / single instance)
│   ├── upstash.ts        # Upstash Redis via REST
│   ├── cloudflare-kv.ts  # Cloudflare KV binding
│   ├── vercel-kv.ts      # Vercel KV (via @vercel/kv)
│   └── deno-kv.ts        # Deno.openKv()
│
├── middleware/
│   ├── nextjs.ts         # Next.js middleware helper
│   ├── hono.ts           # Hono middleware helper
│   └── generic.ts        # Generic (req, res) → Response wrapper
│
└── index.ts              # Barrel exports
```

---

## Storage adapter interface

The entire storage contract is four methods. Every adapter implements this:

```typescript
interface StorageAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlMs: number): Promise<void>;
  increment(key: string, ttlMs: number): Promise<number>;
  delete(key: string): Promise<void>;
}
```

That's it. No scan, no batch, no pub/sub. Deliberately minimal so it maps cleanly to KV stores, Redis, or in-memory maps.

Example — writing a custom adapter:

```typescript
import type { StorageAdapter } from "edgeshield";

export function createMyAdapter(client: MyKVClient): StorageAdapter {
  return {
    get: (key) => client.get(key),
    set: (key, value, ttlMs) => client.set(key, value, { ex: ttlMs }),
    increment: (key, ttlMs) => client.incr(key, { ex: ttlMs }),
    delete: (key) => client.del(key),
  };
}
```

---

## API design

### Rate limiting

```typescript
import { rateLimit, slidingWindow } from "edgeshield/ratelimit";
import { upstash } from "edgeshield/storage/upstash";

const limiter = rateLimit({
  storage: upstash({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  }),
  algorithm: slidingWindow(10, "60s"), // 10 requests per 60 seconds
  identifier: (req) => req.headers.get("x-forwarded-for") ?? "anonymous",
});

// Returns { success: boolean, remaining: number, reset: number, headers: Headers }
const result = await limiter.check(request);
```

**Algorithm options:**

```typescript
import { slidingWindow, fixedWindow, tokenBucket, leakyBucket } from "edgeshield/ratelimit";

slidingWindow(limit, window)      // slidingWindow(100, "15m")
fixedWindow(limit, window)        // fixedWindow(1000, "1h")
tokenBucket(capacity, refillRate) // tokenBucket(10, "1/s")
leakyBucket(capacity, drainRate)  // leakyBucket(50, "10/m")
```

**Duration strings:** `"10s"`, `"5m"`, `"1h"`, `"1d"`. Parsed at config time, not per-request.

**Rate strings:** `"1/s"`, `"10/m"`, `"100/h"`. Parsed the same way.

### Multi-tier rate limiting

```typescript
const limiter = rateLimit({
  storage,
  tiers: [
    { name: "burst",    algorithm: slidingWindow(5, "1s") },
    { name: "sustained", algorithm: slidingWindow(100, "15m") },
    { name: "daily",    algorithm: fixedWindow(10000, "1d") },
  ],
  identifier: (req) => extractApiKey(req) ?? req.ip,
});

// Checks all tiers, fails fast on first exceeded
const result = await limiter.check(request);
// result.tier → "burst" | "sustained" | "daily" | null
```

### Bot detection

```typescript
import { botGuard } from "edgeshield/bot";

const bot = botGuard({
  mode: "detect",  // "detect" | "challenge" | "block"

  // Header/UA pattern rules
  rules: {
    block: [/curl/i, /python-requests/i, /scrapy/i],
    allow: [/googlebot/i, /bingbot/i],          // known good bots
  },

  // Optional JS challenge (proof-of-work)
  challenge: {
    difficulty: 18, // bits of leading zeros
    ttl: "5m",      // challenge validity
  },

  storage, // same adapter — stores challenge tokens
});

const result = await bot.check(request);
// { allowed: boolean, reason: "blocked_ua" | "no_challenge" | "failed_challenge" | "passed", score: number }
```

**Fingerprinting heuristics** (no external deps):
- Header order analysis (browsers have consistent ordering, bots often don't)
- Accept-Language / Accept-Encoding presence and plausibility
- Connection header patterns
- TLS fingerprint via CF-specific headers when available

### CSRF protection

```typescript
import { csrfGuard } from "edgeshield/csrf";

const csrf = csrfGuard({
  mode: "double-submit",  // "double-submit" | "origin-check"
  cookie: {
    name: "__csrf",
    sameSite: "strict",
    secure: true,
    httpOnly: true,
  },
  secret: process.env.CSRF_SECRET, // for HMAC signing
  ttl: "1h",
  ignorePaths: ["/api/webhooks/**"],
});

// For generating a token (in a Server Action or API route)
const token = await csrf.generate(request);

// For validating (in middleware)
const result = await csrf.verify(request);
// { valid: boolean, reason: "missing_token" | "expired" | "mismatch" | "origin_mismatch" | "valid" }
```

---

## Middleware integration

### Next.js

```typescript
// middleware.ts
import { createMiddleware } from "edgeshield/middleware/nextjs";
import { rateLimit, slidingWindow } from "edgeshield/ratelimit";
import { botGuard } from "edgeshield/bot";
import { upstash } from "edgeshield/storage/upstash";

const storage = upstash({ url: "...", token: "..." });

export default createMiddleware(
  rateLimit({
    storage,
    algorithm: slidingWindow(60, "1m"),
    identifier: (req) => req.ip ?? "unknown",
  }),
  botGuard({
    mode: "detect",
    rules: { block: [/curl/i] },
    storage,
  }),
);

export const config = { matcher: ["/api/:path*"] };
```

### Hono

```typescript
import { Hono } from "hono";
import { edgeshield } from "edgeshield/middleware/hono";

const app = new Hono();

app.use("/api/*", edgeshield({
  rateLimit: { algorithm: slidingWindow(100, "15m"), storage },
  bot: { mode: "block", rules: { block: [/scrapy/i] }, storage },
}));
```

### Generic (any framework)

```typescript
import { shield } from "edgeshield/middleware/generic";

const protect = shield({
  rateLimit: { ... },
  bot: { ... },
  csrf: { ... },
  storage,
});

// Returns Response (429/403) or null (allow)
const blocked = await protect(request);
if (blocked) return blocked;
```

---

## Response format

All guards return a consistent result object:

```typescript
interface ShieldResult {
  success: boolean;
  status: 200 | 403 | 429;
  headers: Headers;        // RateLimit-*, Retry-After, Set-Cookie
  reason: string;          // machine-readable reason code
  meta: {
    remaining?: number;    // rate limit remaining
    reset?: number;        // Unix timestamp of window reset
    tier?: string;         // which tier was hit
    score?: number;        // bot detection confidence score
  };
}
```

Headers follow the IETF `RateLimit` header draft standard:
- `RateLimit-Limit`
- `RateLimit-Remaining`
- `RateLimit-Reset`
- `Retry-After`

---

## Configuration presets

For common use cases, ship presets:

```typescript
import { presets } from "edgeshield";

// API rate limiting with bot protection
const apiShield = presets.api({ storage, limit: 100, window: "15m" });

// Auth endpoint protection (strict)
const authShield = presets.auth({ storage, limit: 5, window: "15m" });

// Public page with light bot detection
const pageShield = presets.page({ storage, mode: "detect" });
```

---

## Build & distribution

- **Bundler:** tsup (esbuild-based, fast, handles multiple entry points)
- **Exports map:** each subpath is its own entry point for tree-shaking
- **Formats:** ESM only. No CJS. This is an edge-first package.
- **Target:** ES2022 (all edge runtimes support it)
- **Testing:** vitest with miniflare for Cloudflare Workers compat testing
- **CI:** GitHub Actions — test against Node 20+, Deno, Bun, and miniflare

`package.json` exports:

```json
{
  "name": "edgeshield",
  "type": "module",
  "exports": {
    ".":                    "./dist/index.js",
    "./ratelimit":          "./dist/ratelimit/index.js",
    "./bot":                "./dist/bot/index.js",
    "./csrf":               "./dist/csrf/index.js",
    "./storage/memory":     "./dist/storage/memory.js",
    "./storage/upstash":    "./dist/storage/upstash.js",
    "./storage/cloudflare-kv": "./dist/storage/cloudflare-kv.js",
    "./storage/vercel-kv":  "./dist/storage/vercel-kv.js",
    "./storage/deno-kv":    "./dist/storage/deno-kv.js",
    "./middleware/nextjs":   "./dist/middleware/nextjs.js",
    "./middleware/hono":     "./dist/middleware/hono.js",
    "./middleware/generic":  "./dist/middleware/generic.js"
  },
  "files": ["dist"],
  "sideEffects": false
}
```

---

## Competitive positioning

| Feature | edgeshield | @upstash/ratelimit | rate-limiter-flexible | express-rate-limit |
|---|---|---|---|---|
| Edge-native (no Node APIs) | Yes | Yes | No | No |
| Storage-agnostic | Yes | Upstash only | Redis/Mongo/Postgres | Memory/Redis |
| Rate limiting | Yes | Yes | Yes | Yes |
| Bot detection | Yes | No | No | No |
| CSRF protection | Yes | No | No | No |
| Tree-shakeable subpaths | Yes | No | No | No |
| Zero dependencies | Yes | Needs @upstash/redis | 0 deps (core) | 0 deps |
| Bundle size target | < 4 KB | ~8 KB | ~15 KB | ~5 KB |

---

## Versioning & release plan

**v0.1.0** — Core rate limiting + memory + upstash adapters + Next.js middleware
**v0.2.0** — Bot detection module + Cloudflare KV adapter
**v0.3.0** — CSRF module + Hono middleware + Vercel KV adapter
**v0.4.0** — Presets, Deno KV adapter, analytics hooks
**v1.0.0** — Stable API, full docs site, all adapters battle-tested

---

## Open questions to resolve during implementation

1. **Lua scripts for Redis atomicity** — Upstash REST API doesn't support `EVAL`. Need to decide between multi-command approach (slightly racy) or a compare-and-swap pattern.
2. **Bot fingerprinting depth** — How much heuristic logic to include before it becomes maintenance burden. Start minimal, expand based on real-world false positive data.
3. **Challenge page rendering** — The JS proof-of-work challenge needs an HTML page. Ship a default one or require the user to provide it? Recommendation: ship a minimal default, allow override.
4. **Cloudflare Rate Limiting binding** — CF has a native `RateLimiter` binding in Workers. Worth wrapping as an adapter or does it conflict with the storage model? Probably worth it as a separate adapter since its API is different from KV.