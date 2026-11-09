import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/bot/index.ts",
    "src/csrf/index.ts",
    "src/ratelimit/index.ts",
    "src/presets/index.ts",
    "src/storage/cloudflare-kv.ts",
    "src/storage/vercel-kv.ts",
    "src/storage/memory.ts",
    "src/storage/upstash.ts",
    "src/storage/deno-kv.ts",
    "src/storage/cloudflare-rate-limit.ts",
    "src/middleware/generic.ts",
    "src/middleware/hono.ts",
    "src/middleware/nextjs.ts",
    "src/middleware/sveltekit.ts",
    "src/middleware/astro.ts"
  ],
  format: ["esm"],
  target: "es2022",
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  minify: true
});
