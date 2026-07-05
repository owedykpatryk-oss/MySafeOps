#!/usr/bin/env node
/**
 * Send a fix request from phone/CLI to a Cursor Cloud Agent.
 *
 * Preferred (API — no Automations UI):
 *   1. Cursor Dashboard → Integrations → API Keys
 *   2. CURSOR_API_KEY=... in .env.local
 *   3. npm run fix:mobile -- "Hot work PDF missing fire watch"
 *
 * Fallback (webhook automation):
 *   CURSOR_WEBHOOK_URL + optional CURSOR_WEBHOOK_SECRET
 *
 * Usage:
 *   node scripts/cursor-mobile-fix.mjs "Hot work PDF missing fire watch"
 *   node scripts/cursor-mobile-fix.mjs "Survey simple mode broken" --module survey
 *   node scripts/cursor-mobile-fix.mjs --file payload.json
 */

import {
  createCloudAgent,
  loadCursorEnv,
  loadPrompt,
} from "./cursor-agent-api.mjs";

loadCursorEnv();

const args = process.argv.slice(2);
const apiKey = process.env.CURSOR_API_KEY?.trim();
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

if (apiKey) {
  const ticket = [
    `Problem: ${body.message}`,
    body.module ? `Where: ${body.module}` : "",
    `Urgency: ${body.urgency}`,
    `Source: ${body.source} at ${body.at}`,
  ]
    .filter(Boolean)
    .join("\n");

  const promptText = `${loadPrompt("mobile")}\n\n## Webhook payload\n\`\`\`json\n${JSON.stringify(body, null, 2)}\n\`\`\`\n\n## Ticket\n${ticket}`;

  try {
    const result = await createCloudAgent({
      promptText,
      name: "MySafeOps mobile fix",
      apiKey,
    });
    console.log("OK — cloud agent started (API).");
    if (result?.agent?.url) console.log(`Agent: ${result.agent.url}`);
    process.exit(0);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

if (!url) {
  console.error(
    "Missing CURSOR_API_KEY or CURSOR_WEBHOOK_URL.\n" +
      "  API: Cursor Dashboard → Integrations → API Keys → .env.local\n" +
      "  Webhook: save Mobile fix automation and set CURSOR_WEBHOOK_URL",
  );
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
console.log("OK — cloud agent triggered (webhook).");
if (text) console.log(text);
