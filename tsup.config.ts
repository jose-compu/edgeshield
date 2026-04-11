import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/bot/index.ts",
    "src/ratelimit/index.ts",
    "src/storage/cloudflare-kv.ts",
    "src/storage/memory.ts",
    "src/storage/upstash.ts",
    "src/middleware/nextjs.ts"
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
