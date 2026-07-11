#!/usr/bin/env node
/**
 * Trigger a Cursor Cloud Agent via API (no Automations UI required).
 *
 * Setup:
 *   1. Cursor Dashboard → Integrations → API Keys
 *   2. CURSOR_API_KEY=... in .env.local (local) or GitHub secret (CI)
 *
 * Usage:
 *   node scripts/cursor-cloud-agent.mjs ci-fix --run-url https://github.com/.../actions/runs/123
 *   node scripts/cursor-cloud-agent.mjs mobile --message "Hot work PDF missing fire watch"
 *   node scripts/cursor-cloud-agent.mjs sentry --message "Sentry issue URL"
 *   node scripts/cursor-cloud-agent.mjs pr-review --pr-url https://github.com/.../pull/1
 *   node scripts/cursor-cloud-agent.mjs --list
 */
import {
  AGENT_TYPES,
  createCloudAgent,
  findActiveAgentDuplicate,
  getCursorApiKey,
  loadCursorEnv,
  loadPrompt,
} from "./cursor-agent-api.mjs";
import { appendFileSync } from "node:fs";

loadCursorEnv();

const args = process.argv.slice(2);

function usage() {
  console.error(`Usage:
  node scripts/cursor-cloud-agent.mjs <type> [options]
  node scripts/cursor-cloud-agent.mjs --list

Types: ${Object.keys(AGENT_TYPES).join(", ")}

Options:
  --message <text>     Extra context (ticket body, Sentry URL, etc.)
  --run-url <url>      Failed GitHub Actions run URL (ci-fix)
  --pr-url <url>       GitHub PR URL (agent works on PR branch)
  --ref <branch>       Starting ref when no --pr-url (default: main)
  --name <label>       Agent display name (optional)
  --no-pr              Do not auto-open a PR when done
  --skip-if-active     Skip when an agent with the same name is already active
  --dry-run            Print final prompt only`);
  process.exit(1);
}

if (args[0] === "--list" || args[0] === "-h" || args[0] === "--help") {
  if (args[0] === "--list") {
    for (const [type, file] of Object.entries(AGENT_TYPES)) {
      console.log(`${type}\t${file}`);
    }
    process.exit(0);
  }
  usage();
}

const type = args[0];
if (!type || !AGENT_TYPES[type]) usage();

let message = "";
let runUrl = "";
let prUrl = "";
let startingRef = process.env.CURSOR_GITHUB_REF?.trim() || "main";
let name = "";
let autoCreatePR = true;
let dryRun = false;
let skipIfActive = false;

for (let i = 1; i < args.length; i++) {
  const a = args[i];
  if (a === "--message" && args[i + 1]) message = args[++i];
  else if (a === "--run-url" && args[i + 1]) runUrl = args[++i];
  else if (a === "--pr-url" && args[i + 1]) prUrl = args[++i];
  else if (a === "--ref" && args[i + 1]) startingRef = args[++i];
  else if (a === "--name" && args[i + 1]) name = args[++i];
  else if (a === "--no-pr") autoCreatePR = false;
  else if (a === "--skip-if-active") skipIfActive = true;
  else if (a === "--dry-run") dryRun = true;
  else usage();
}

const sections = [loadPrompt(type)];

if (runUrl) {
  sections.push("", "## CI failure context", `- Failed run: ${runUrl}`);
}
if (message) {
  sections.push("", "## Ticket", message);
}
if (!prUrl && startingRef !== "main") {
  sections.push("", `## Branch`, `Start from \`${startingRef}\`.`);
}

const promptText = sections.join("\n").trim();
const displayName = name || `MySafeOps ${type}`;

if (dryRun) {
  console.log(promptText);
  process.exit(0);
}

try {
  getCursorApiKey();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

try {
  if (skipIfActive) {
    const duplicate = await findActiveAgentDuplicate(displayName);
    if (duplicate) {
      console.log(`Skipped — active agent already running: ${duplicate.url ?? duplicate.id}`);
      process.exit(0);
    }
  }

  const result = await createCloudAgent({
    promptText,
    name: displayName,
    startingRef: prUrl ? undefined : startingRef,
    prUrl: prUrl || undefined,
    autoCreatePR,
  });

  const agent = result?.agent;
  const run = result?.run;
  console.log("OK — cloud agent started.");
  if (agent?.url) console.log(`Agent: ${agent.url}`);
  if (agent?.id) console.log(`Agent id: ${agent.id}`);
  if (run?.id) console.log(`Run id: ${run.id}`);
  if (run?.status) console.log(`Run status: ${run.status}`);

  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (summaryFile && agent?.url) {
    appendFileSync(summaryFile, `### Cursor ${type}\n\n- **Agent:** ${agent.url}\n`);
  }
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
