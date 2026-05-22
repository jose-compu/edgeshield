import { execSync, spawn } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const port = process.env.DOCS_PORT ?? "4173";
const branch = process.env.DOCS_BRANCH ?? "docs";
const root = new URL("..", import.meta.url).pathname;
const tempDir = mkdtempSync(join(tmpdir(), "edgeshield-docs-"));

function run(command) {
  execSync(command, { cwd: root, stdio: "inherit" });
}

try {
  run(`git fetch origin ${branch} 2>/dev/null || true`);

  const ref = (() => {
    try {
      execSync(`git rev-parse --verify ${branch}`, { cwd: root, stdio: "pipe" });
      return branch;
    } catch {
      try {
        execSync(`git rev-parse --verify origin/${branch}`, { cwd: root, stdio: "pipe" });
        return `origin/${branch}`;
      } catch {
        console.error(`Docs branch "${branch}" not found. Create it first, then retry.`);
        process.exit(1);
      }
    }
  })();

  run(`git archive ${ref} docs | tar -x -C ${tempDir}`);
  const siteDir = join(tempDir, "docs");

  if (!existsSync(join(siteDir, "index.html"))) {
    console.error(`No docs/index.html found on ${ref}.`);
    process.exit(1);
  }

  console.log(`Serving ${ref}:docs at http://localhost:${port}`);
  const child = spawn("npx", ["--yes", "serve", siteDir, "-p", port], {
    cwd: root,
    stdio: "inherit",
    shell: true
  });

  const cleanup = () => {
    rmSync(tempDir, { recursive: true, force: true });
  };

  child.on("exit", cleanup);
  process.on("SIGINT", () => {
    cleanup();
    process.exit(0);
  });
} catch (error) {
  rmSync(tempDir, { recursive: true, force: true });
  throw error;
}
