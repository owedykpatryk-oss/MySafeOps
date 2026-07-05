#!/usr/bin/env node
/**
 * Send a fix request to your Cursor Automation webhook (Mobile fix webhook).
 *
 * Setup (once):
 *   1. Save automation "MySafeOps — Mobile fix webhook" in Cursor Automations.
 *   2. Copy webhook URL + secret from the automation settings.
 *   3. Set env vars (PowerShell):
 *        $env:CURSOR_WEBHOOK_URL = "https://..."
 *        $env:CURSOR_WEBHOOK_SECRET = "..."
 *
 * Usage:
 *   node scripts/cursor-mobile-fix.mjs "Hot work PDF missing fire watch"
 *   node scripts/cursor-mobile-fix.mjs "Survey simple mode broken" --module survey
 *   node scripts/cursor-mobile-fix.mjs --file payload.json
 */

const args = process.argv.slice(2);
const url = process.env.CURSOR_WEBHOOK_URL?.trim();
const secret = process.env.CURSOR_WEBHOOK_SECRET?.trim();

function usage() {
  console.error(`Usage:
  node scripts/cursor-mobile-fix.mjs "<problem>" [--module permits|survey|rams] [--urgency low|normal|high]
  node scripts/cursor-mobile-fix.mjs --file payload.json`);
  process.exit(1);
}

let body = null;
if (args[0] === "--file" && args[1]) {
  const fs = await import("node:fs");
  body = JSON.parse(fs.readFileSync(args[1], "utf8"));
} else if (args[0] && !args[0].startsWith("--")) {
  const message = args[0];
  let module = "";
  let urgency = "normal";
  for (let i = 1; i < args.length; i++) {
    if (args[i] === "--module" && args[i + 1]) module = args[++i];
    if (args[i] === "--urgency" && args[i + 1]) urgency = args[++i];
  }
  body = { message, module, urgency, source: "cursor-mobile-fix.mjs", at: new Date().toISOString() };
} else {
  usage();
}

if (!url) {
  console.error("Missing CURSOR_WEBHOOK_URL. Save the Mobile fix webhook automation in Cursor, then set the env var.");
  process.exit(1);
}

const headers = { "Content-Type": "application/json" };
if (secret) headers.Authorization = `Bearer ${secret}`;

const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
const text = await res.text();
if (!res.ok) {
  console.error(`Webhook failed ${res.status}: ${text}`);
  process.exit(1);
}
console.log("OK — cloud agent triggered.");
if (text) console.log(text);
