#!/usr/bin/env node
/**
 * Fail if a Vite build log contains circular chunk warnings (TDZ risk in production).
 * Usage: node scripts/check-vite-circular-chunks.mjs [path-to-log]
 *        npm run build 2>&1 | tee build-output.txt && node scripts/check-vite-circular-chunks.mjs build-output.txt
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const logPath = resolve(process.cwd(), process.argv[2] || "build-output.txt");
if (!existsSync(logPath)) {
  console.error(`✗ Missing build log: ${logPath}`);
  process.exit(1);
}

const text = readFileSync(logPath, "utf8");
const hits = text.split(/\r?\n/).filter((line) => /Circular chunk:/i.test(line));
if (hits.length) {
  console.error("✗ Vite circular chunks detected (TDZ risk):\n");
  for (const line of hits.slice(0, 40)) console.error(`  ${line}`);
  if (hits.length > 40) console.error(`  …and ${hits.length - 40} more`);
  process.exit(1);
}

console.log("✓ No Vite circular chunks in build log");
