# Rate-limit-only sample

Minimal EdgeShield usage: sliding-window rate limit with in-memory storage.

```bash
# from repo root after npm install && npm run build
node --experimental-strip-types examples/rate-limit-only/server.ts
# or: npx tsx examples/rate-limit-only/server.ts
```

Then:

```bash
curl -i http://127.0.0.1:8787/
```

After the configured limit, responses return `429` with rate-limit headers.
