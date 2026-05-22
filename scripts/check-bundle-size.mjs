#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

/** Gzip size budgets in bytes. Ratelimit is a hard fail; others are advisory. */
const BUDGETS = [
  { file: "dist/ratelimit/index.js", maxBytes: 4 * 1024, required: true },
  { file: "dist/bot/index.js", maxBytes: 12 * 1024, required: false },
  { file: "dist/csrf/index.js", maxBytes: 6 * 1024, required: false },
  { file: "dist/middleware/generic.js", maxBytes: 2 * 1024, required: false },
  { file: "dist/presets/index.js", maxBytes: 8 * 1024, required: false },
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
