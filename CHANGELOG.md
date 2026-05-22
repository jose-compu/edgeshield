# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Bot challenge mode with default HTML renderer and custom `ChallengeRenderer` override ([#6](https://github.com/jose-compu/edgeshield/issues/6))
- Generic middleware helper at `edgeshield/middleware/generic` ([#4](https://github.com/jose-compu/edgeshield/issues/4))
- Composite presets: `apiShield`, `authShield`, `pageShield` ([#13](https://github.com/jose-compu/edgeshield/issues/13))
- Dedicated `edgeshield/presets` subpath export ([#20](https://github.com/jose-compu/edgeshield/issues/20))
- Bundle size CI check via `npm run size:check` ([#14](https://github.com/jose-compu/edgeshield/issues/14))
- Storage adapter cookbook in README ([#19](https://github.com/jose-compu/edgeshield/issues/19))
- GitHub Actions release workflow ([#18](https://github.com/jose-compu/edgeshield/issues/18))
- Deno KV storage adapter ([#2](https://github.com/jose-compu/edgeshield/issues/2))
- Shared storage adapter conformance suite ([#8](https://github.com/jose-compu/edgeshield/issues/8))
- Bun and Deno runtime CI jobs ([#11](https://github.com/jose-compu/edgeshield/issues/11))

## [0.3.0] - 2026-04-01

### Added

- CSRF protection (`double-submit` and `origin-check` modes)
- Hono middleware helper
- Vercel KV storage adapter
- Sloth VDF bot challenge headers for block mode

## [0.2.0] - 2026-03-01

### Added

- Bot detection module (`detect` and `block` modes)
- Header fingerprinting and user-agent rules
- Cloudflare KV storage adapter

## [0.1.0] - 2026-02-01

### Added

- Core rate limiting (sliding and fixed window)
- Multi-tier rate limit policies
- Memory and Upstash storage adapters
- Next.js middleware helper

[Unreleased]: https://github.com/jose-compu/edgeshield/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/jose-compu/edgeshield/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/jose-compu/edgeshield/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/jose-compu/edgeshield/releases/tag/v0.1.0
