#!/usr/bin/env node
/**
 * Print a truncated snippet of failed GitHub Actions job logs (for Cursor prompts).
 *
 * Usage:
 *   node scripts/github-failed-log-snippet.mjs --run-url https://github.com/org/repo/actions/runs/123
 *   node scripts/github-failed-log-snippet.mjs --run-id 123 --repo owedykpatryk-oss/MySafeOps
 *
 * Requires GITHUB_TOKEN or GH_TOKEN in CI; locally uses `gh` if available.
 */
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
let runUrl = "";
let runId = "";
let repo = process.env.GITHUB_REPOSITORY || "";
let maxLines = Number(process.env.CURSOR_CI_LOG_LINES || 200);

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--run-url" && args[i + 1]) runUrl = args[++i];
  else if (a === "--run-id" && args[i + 1]) runId = args[++i];
  else if (a === "--repo" && args[i + 1]) repo = args[++i];
  else if (a === "--lines" && args[i + 1]) maxLines = Number(args[++i]);
}

if (!runId && runUrl) {
  const match = runUrl.match(/\/actions\/runs\/(\d+)/);
  if (match) runId = match[1];
}

if (!runId) {
  console.error("Usage: github-failed-log-snippet.mjs --run-url <url> [--repo org/repo] [--lines 200]");
  process.exit(1);
}

const ghArgs = ["run", "view", runId, "--log-failed"];
if (repo) ghArgs.push("--repo", repo);

const result = spawnSync("gh", ghArgs, {
  encoding: "utf8",
  env: process.env,
  maxBuffer: 10 * 1024 * 1024,
});

const raw = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
if (!raw) {
  console.log(`(Could not fetch failed logs for run ${runId} — agent should inspect ${runUrl || "the run URL"} manually.)`);
  process.exit(0);
}

const lines = raw.split(/\r?\n/);
const snippet = lines.slice(-maxLines).join("\n");
console.log(snippet);
