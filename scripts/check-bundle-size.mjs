#!/usr/bin/env node
// check-bundle-size.mjs
//
// Gzip-based bundle size checking for edgeshield's subpath exports.
//
// Why gzip: gzip-compressed size better reflects what production users
// actually download than raw byte length. This matches how bundlers
// (webpack, esbuild, Turbopack) report bundle size in production builds.
//
// How it works:
//   1. Read each built JS file from disk.
//   2. gzip it in-memory (no temp files needed — Node zlib is synchronous
//      for small inputs and has no async penalty at this scale).
//   3. Compare against the budget defined below.
//   4. Hard fail only for ratelimit (core path, largest surface area);
//      other subpaths produce advisory warnings so feature additions
//      don't block CI without discussion.

import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

/** Gzip size budgets in bytes. Ratelimit is a hard fail; others are advisory. */
const BUDGETS = [
  // ratelimit is the most-imported subpath — keep it tight so it stays fast on cold starts
  { file: "dist/ratelimit/index.js", maxBytes: 4 * 1024, required: true },
  // bot detection includes VDF and rules engines — larger by nature
  { file: "dist/bot/index.js", maxBytes: 12 * 1024, required: false },
  // csrf is small by design (cookie + header comparison)
  { file: "dist/csrf/index.js", maxBytes: 6 * 1024, required: false },
  // generic middleware is a thin wrapper — few deps
  { file: "dist/middleware/generic.js", maxBytes: 2 * 1024, required: false },
  // presets bundle composite config — can grow as new presets are added
  { file: "dist/presets/index.js", maxBytes: 8 * 1024, required: false },
  // deno-kv adapter is platform-specific and rarely tree-shaken
  { file: "dist/storage/deno-kv.js", maxBytes: 2 * 1024, required: false }
  // TODO: When adding new export paths, add a budget entry here.
  //       Follow the pattern: estimate maxBytes based on source LOC;
  //       mark required:true only for paths imported by every user.
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
