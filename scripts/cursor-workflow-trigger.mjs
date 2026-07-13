#!/usr/bin/env node
/**
 * Trigger a Cursor cloud agent from a failed GitHub Actions workflow (CI / billing).
 * Collects failed log snippet, deduplicates active agents, writes GITHUB_STEP_SUMMARY.
 *
 * Usage:
 *   node scripts/cursor-workflow-trigger.mjs ci-fix --run-url <url> --ref main --branch main --sha abc
 *   node scripts/cursor-workflow-trigger.mjs billing --run-url <url> --ref main --branch main --sha abc
 */
import { appendFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import {
  AGENT_TYPES,
  createCloudAgent,
  findActiveAgentDuplicate,
  getCursorApiKey,
  isCursorBillingBlock,
  loadCursorEnv,
  loadPrompt,
} from "./cursor-agent-api.mjs";

loadCursorEnv();

const args = process.argv.slice(2);
const type = args[0];

if (!type || !AGENT_TYPES[type]) {
  console.error(`Usage: cursor-workflow-trigger.mjs <${Object.keys(AGENT_TYPES).join("|")}> --run-url <url> [--ref branch] [--branch name] [--sha sha] [--event push]`);
  process.exit(1);
}

let runUrl = "";
let startingRef = "main";
let branch = "main";
let sha = "";
let event = "push";
let dryRun = false;

for (let i = 1; i < args.length; i++) {
  const a = args[i];
  if (a === "--run-url" && args[i + 1]) runUrl = args[++i];
  else if (a === "--ref" && args[i + 1]) startingRef = args[++i];
  else if (a === "--branch" && args[i + 1]) branch = args[++i];
  else if (a === "--sha" && args[i + 1]) sha = args[++i];
  else if (a === "--event" && args[i + 1]) event = args[++i];
  else if (a === "--dry-run") dryRun = true;
}

if (!runUrl) {
  console.error("Missing --run-url");
  process.exit(1);
}

function fetchFailedLogSnippet() {
  const runIdMatch = runUrl.match(/\/actions\/runs\/(\d+)/);
  const runId = runIdMatch?.[1];
  if (!runId) return "";

  const repo = process.env.GITHUB_REPOSITORY || "";
  const ghArgs = ["run", "view", runId, "--log-failed"];
  if (repo) ghArgs.push("--repo", repo);

  const result = spawnSync("gh", ghArgs, {
    encoding: "utf8",
    env: process.env,
    maxBuffer: 10 * 1024 * 1024,
  });

  const raw = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
  if (!raw) return "";
  const maxLines = Number(process.env.CURSOR_CI_LOG_LINES || 200);
  return raw.split(/\r?\n/).slice(-maxLines).join("\n");
}

function writeSummary(body) {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (file) appendFileSync(file, `${body}\n`);
}

try {
  getCursorApiKey();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

const displayName = `MySafeOps ${type}`;
const logSnippet = fetchFailedLogSnippet();

const sections = [loadPrompt(type), "", "## CI failure context", `- Failed run: ${runUrl}`];
if (sha) sections.push(`- SHA: \`${sha}\``);
if (branch) sections.push(`- Branch: \`${branch}\``);
if (event) sections.push(`- Event: ${event}`);

sections.push("", "## Ticket", `Event: ${event} | Branch: ${branch} | SHA: ${sha}`);

if (logSnippet) {
  sections.push("", "## Failed job logs (tail)", "```", logSnippet, "```");
}

if (startingRef && startingRef !== "main") {
  sections.push("", "## Branch", `Start from \`${startingRef}\`.`);
}

const promptText = sections.join("\n").trim();

if (dryRun) {
  console.log(promptText);
  process.exit(0);
}

try {
  const duplicate = await findActiveAgentDuplicate(displayName);
  if (duplicate) {
    const msg = `Skipped — active agent already running: ${duplicate.url ?? duplicate.id}`;
    console.log(msg);
    writeSummary(`### Cursor ${type}\n\n${msg}\n`);
    process.exit(0);
  }

  const result = await createCloudAgent({
    promptText,
    name: displayName,
    startingRef,
  });

  const agent = result?.agent;
  const lines = ["OK — cloud agent started."];
  if (agent?.url) lines.push(`Agent: ${agent.url}`);
  if (agent?.id) lines.push(`Agent id: ${agent.id}`);
  if (result?.run?.status) lines.push(`Run status: ${result.run.status}`);

  const output = lines.join("\n");
  console.log(output);

  writeSummary(
    [
      `### Cursor ${type}`,
      "",
      `- **Branch:** \`${branch}\``,
      sha ? `- **SHA:** \`${sha}\`` : "",
      `- **Failed run:** ${runUrl}`,
      agent?.url ? `- **Agent:** ${agent.url}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  );
} catch (err) {
  if (isCursorBillingBlock(err)) {
    const msg = `Skipped — Cursor agent billing limit (${err.message})`;
    console.log(msg);
    writeSummary(`### Cursor ${type}\n\n${msg}\n`);
    process.exit(0);
  }
  console.error(err.message);
  process.exit(1);
}
