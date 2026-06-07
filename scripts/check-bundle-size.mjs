#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

/**
 * Gzip size budgets in bytes. The script reads built output from dist/, gzips the
 * JavaScript payload in memory, and compares that compressed size to each budget.
 *
 * TODO: When adding a new package.json export path that needs size tracking,
 * register its built dist file here with an appropriate budget.
 */
const BUDGETS = [
  // Ratelimit is core edge middleware, so exceeding its budget is a hard CI fail.
  { file: "dist/ratelimit/index.js", maxBytes: 4 * 1024, required: true },
  // Bot detection includes broader heuristics, so it has the largest advisory cap.
  { file: "dist/bot/index.js", maxBytes: 12 * 1024, required: false },
  // CSRF helpers should stay lightweight for apps that only need form protection.
  { file: "dist/csrf/index.js", maxBytes: 6 * 1024, required: false },
  // Generic middleware should remain a tiny adapter around the shared primitives.
  { file: "dist/middleware/generic.js", maxBytes: 2 * 1024, required: false },
  // Presets combine defaults from multiple modules, so the advisory cap is roomier.
  { file: "dist/presets/index.js", maxBytes: 8 * 1024, required: false },
  // Deno KV storage should stay small because it targets edge-native runtimes.
  { file: "dist/storage/deno-kv.js", maxBytes: 2 * 1024, required: false }
];

function gzipSize(path) {
  const source = readFileSync(path);
  return gzipSync(source).byteLength;
}

function formatKb(bytes) {
  return `${(bytes / 1024).toFixed(2)} KB`;
}

let failed = false;

console.log("Bundle size report (gzip):");
for (const budget of BUDGETS) {
  const size = gzipSize(budget.file);
  const ok = size <= budget.maxBytes;
  const status = ok ? "ok" : budget.required ? "FAIL" : "warn";
  console.log(`  [${status}] ${budget.file}: ${formatKb(size)} / ${formatKb(budget.maxBytes)}`);
  if (!ok && budget.required) {
    failed = true;
  }
}

if (failed) {
  console.error("\nOne or more required bundle budgets were exceeded.");
  process.exit(1);
}

console.log("\nAll required bundle budgets passed.");
