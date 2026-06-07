# Contributing to EdgeShield

Thanks for your interest in contributing! This document covers everything you need to get started.

## Prerequisites

- **Node.js 20+** (required for development)
- **npm** (included with Node.js)
- **Bun** or **Deno 2.x** (optional, for multi-runtime testing)

## Setup

```bash
# Clone and install
git clone https://github.com/jose-compu/edgeshield.git
cd edgeshield
npm ci

# Verify setup
npm test
npm run build
npm run size:check
```

## Development Commands

| Command | Description |
|---------|-------------|
| `npm test` | Run all Vitest tests |
| `npm run test:coverage` | Run tests with coverage reporting |
| `npm run build` | Build with tsup |
| `npm run size:check` | Verify bundle sizes against budgets |
| `npm run lint` | ESLint check |
| `npm run typecheck` | TypeScript type check (`tsc --noEmit`) |
| `npm run docs:serve` | Serve docs site locally (pulls from `docs` branch) |
| `npm run test:bun` | Run tests with Bun |
| `npm run build && npm run test:deno` | Run Deno smoke tests |

## Project Structure

```
src/
  bot/          — Bot detection module
  core/         — Shared types and utilities (time, storage interface)
  csrf/         — CSRF protection module
  middleware/   — Framework middleware (Next.js, Hono, generic)
  presets/      — Preset configurations and composite shields
  ratelimit/    — Rate limiting algorithms
  storage/      — Storage adapters (memory, upstash, cloudflare-kv, vercel-kv, deno-kv)
test/           — Vitest test files (mirrors src/ structure)
scripts/        — Build and CI tooling
docs/           — GitHub Pages documentation site
```

## Pull Request Checklist

Before submitting a PR, please ensure:

- [ ] Tests pass: `npm test`
- [ ] Lint passes: `npm run lint`
- [ ] TypeScript compiles: `npm run typecheck`
- [ ] Bundle sizes are within budget: `npm run size:check`
- [ ] Coverage does not drop: `npm run test:coverage`
- [ ] Your branch is rebased on latest `main`

## Code Style

- This project uses **TypeScript** with strict mode enabled.
- Use ESLint and Prettier conventions (run `npm run lint`).
- Exported APIs must have **JSDoc** annotations.
- Every new storage adapter must pass the **conformance test suite** (`test/storage/adapterConformance.test.ts`).

## Good First Issues

Looking for a place to start? Browse [good first issues](https://github.com/jose-compu/edgeshield/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) — these are tagged specifically for new contributors.

## Adding Your Project to the Adopters List

If you're using EdgeShield in production, we'd love to include your project in the [Adopters](./README.md#adopters) list. Open a PR adding a row to the table in the README.

## License

By contributing, you agree that your contributions will be licensed under the project's [MIT License](./LICENSE).
