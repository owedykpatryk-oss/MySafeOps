#!/usr/bin/env node
/**
 * Push CURSOR_API_KEY from .env.local to GitHub Actions secrets (one-time setup).
 * Does not print the key.
 */
import { spawnSync } from "node:child_process";
import { getCursorApiKey, loadCursorEnv } from "./cursor-agent-api.mjs";

loadCursorEnv();

let key;
try {
  key = getCursorApiKey();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

const repo = process.env.GITHUB_REPOSITORY || "owedykpatryk-oss/MySafeOps";
const result = spawnSync("gh", ["secret", "set", "CURSOR_API_KEY", "--repo", repo], {
  input: key,
  stdio: ["pipe", "inherit", "inherit"],
  encoding: "utf8",
});

if (result.status !== 0) {
  console.error("gh secret set failed. Run: gh auth login");
  process.exit(result.status ?? 1);
}

console.log(`OK — CURSOR_API_KEY set on ${repo} (GitHub Actions).`);
