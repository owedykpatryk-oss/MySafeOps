#!/usr/bin/env node
/**
 * Fail CI if third-party survey docs (client/site data) are tracked in git.
 * Allowed: DOCS/Survey/README.local-only.md only.
 */

import { execSync } from "node:child_process";

const ALLOWED = new Set(["DOCS/Survey/README.local-only.md"]);

function main() {
  let tracked = [];
  try {
    tracked = execSync('git ls-files "DOCS/Survey"', { encoding: "utf8" })
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    tracked = [];
  }

  const blocked = tracked.filter((p) => !ALLOWED.has(p.replace(/\\/g, "/")));

  if (blocked.length) {
    console.error("Survey docs guard failed — remove these from git (local disk only):\n");
    blocked.forEach((p) => console.error(`  - ${p}`));
    console.error("\nSee DOCS/Survey/README.local-only.md and root .gitignore.");
    process.exit(1);
  }

  console.log("Survey docs guard OK — no sensitive DOCS/Survey files tracked.");
}

main();
