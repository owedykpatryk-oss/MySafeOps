#!/usr/bin/env node
/**
 * Nightly Cursor cloud agents — health, Vercel, Sentry, open PR reviews.
 *
 * Usage:
 *   node scripts/cursor-nightly.mjs --all
 *   node scripts/cursor-nightly.mjs --health --vercel
 *   node scripts/cursor-nightly.mjs --weekend --health
 *   node scripts/cursor-nightly.mjs --prs --dry-run
 */
import {
  createCloudAgent,
  getCursorApiKey,
  loadCursorEnv,
  loadPrompt,
} from "./cursor-agent-api.mjs";

loadCursorEnv();

const args = process.argv.slice(2);
const GITHUB_REPO = process.env.GITHUB_REPOSITORY || "owedykpatryk-oss/MySafeOps";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
const STAGGER_MS = Number(process.env.CURSOR_NIGHTLY_STAGGER_MS || 90_000);
const PR_DAYS = Number(process.env.CURSOR_PR_DAYS || 7);
const MAX_AGENTS = Number(process.env.CURSOR_MAX_AGENTS || 4);

const flags = {
  health: args.includes("--health"),
  vercel: args.includes("--vercel"),
  sentry: args.includes("--sentry"),
  prs: args.includes("--prs"),
  all: args.includes("--all"),
  weekend: args.includes("--weekend"),
  dryRun: args.includes("--dry-run"),
  forceSentry: args.includes("--force-sentry"),
};

if (args.includes("--help") || args.includes("-h")) {
  console.log(`Usage:
  node scripts/cursor-nightly.mjs --all
  node scripts/cursor-nightly.mjs --health --vercel --sentry --prs
  node scripts/cursor-nightly.mjs --weekend --health
  node scripts/cursor-nightly.mjs --dry-run --all

Env:
  CURSOR_PR_DAYS=7       Only review PRs updated in last N days
  CURSOR_MAX_AGENTS=4    Cap agents launched per run
  CURSOR_NIGHTLY_STAGGER_MS=90000`);
  process.exit(0);
}

if (flags.all) {
  flags.health = true;
  flags.vercel = true;
  flags.sentry = true;
  flags.prs = true;
}

if (!flags.health && !flags.vercel && !flags.sentry && !flags.prs) {
  console.error("Pick at least one: --health, --vercel, --sentry, --prs, or --all");
  process.exit(1);
}

let launched = 0;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isMondayUtc() {
  return new Date().getUTCDay() === 1;
}

function resolveSentry() {
  if (!flags.sentry) return false;
  if (flags.forceSentry) return true;
  if (flags.all && !isMondayUtc()) {
    console.log("Sentry skipped (nightly full run only runs Sentry on Mondays UTC). Use --sentry to force.");
    return false;
  }
  return true;
}

const runSentry = resolveSentry();

async function listOpenPullRequests() {
  if (!GITHUB_TOKEN) {
    console.warn("No GITHUB_TOKEN — skipping PR list (set in GitHub Actions automatically).");
    return [];
  }
  const url = `https://api.github.com/repos/${GITHUB_REPO}/pulls?state=open&sort=updated&direction=desc&per_page=20`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      "User-Agent": "mysafeops-cursor-nightly",
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
  }
  const prs = await res.json();
  const cutoff = Date.now() - PR_DAYS * 24 * 60 * 60 * 1000;
  const fresh = prs.filter((pr) => new Date(pr.updated_at).getTime() >= cutoff);
  if (fresh.length < prs.length) {
    console.log(`PR filter: ${fresh.length}/${prs.length} open PRs updated in last ${PR_DAYS} days.`);
  }
  return fresh;
}

async function launchAgent({ name, promptText, prUrl, autoCreatePR = true }) {
  if (!flags.dryRun && launched >= MAX_AGENTS) {
    console.warn(`Agent cap reached (${MAX_AGENTS}) — skipping: ${name}`);
    return null;
  }
  if (flags.dryRun) {
    console.log(`\n--- dry-run: ${name} ---\n${promptText}\n`);
    return { dryRun: true, name };
  }
  const result = await createCloudAgent({
    promptText,
    name,
    prUrl,
    autoCreatePR,
  });
  launched += 1;
  const agentUrl = result?.agent?.url ?? "(no url)";
  console.log(`Started: ${name}`);
  console.log(`  ${agentUrl}`);
  return result;
}

const NIGHTLY = `Scheduled run: ${new Date().toISOString()} (GitHub Actions nightly).`;

const tasks = [];

if (flags.health) {
  tasks.push(async () => {
    const weekendNote = flags.weekend
      ? "\n\n## Weekend mode\nLight check only: `npm ci && npm run lint && npm test` — skip Playwright e2e and production build."
      : "";
    const promptText = `${loadPrompt("daily-health")}\n\n## Context\n${NIGHTLY}${weekendNote}`;
    return launchAgent({
      name: flags.weekend ? "MySafeOps weekend health" : "MySafeOps nightly health",
      promptText,
    });
  });
}

if (flags.vercel && !flags.weekend) {
  tasks.push(async () => {
    const promptText = `${loadPrompt("vercel")}\n\n## Context\n${NIGHTLY}\nInspect latest **production** deployment first. Only open a fix PR if build failed or there is a clear regression.`;
    return launchAgent({
      name: "MySafeOps nightly Vercel",
      promptText,
    });
  });
}

if (runSentry && !flags.weekend) {
  tasks.push(async () => {
    const promptText = `${loadPrompt("sentry")}\n\n## Context\n${NIGHTLY}\nNightly scan: unresolved Sentry issues from the last 24h. Fix only clear, low-risk bugs with a repro path in this repo. Skip flaky or needs-repro issues — list them in output instead.`;
    return launchAgent({
      name: "MySafeOps nightly Sentry",
      promptText,
    });
  });
}

if (flags.prs && !flags.weekend) {
  tasks.push(async () => {
    const prs = await listOpenPullRequests();
    if (!prs.length) {
      console.log("No qualifying open PRs — skipping pr-review.");
      return null;
    }
    const results = [];
    for (let i = 0; i < prs.length; i++) {
      const pr = prs[i];
      const promptText = `${loadPrompt("pr-review")}\n\n## Context\n${NIGHTLY}\nReview PR #${pr.number}: ${pr.title}`;
      results.push(
        await launchAgent({
          name: `MySafeOps PR review #${pr.number}`,
          promptText,
          prUrl: pr.html_url,
          autoCreatePR: false,
        }),
      );
      if (!flags.dryRun && i < prs.length - 1 && launched < MAX_AGENTS) {
        await sleep(STAGGER_MS);
      }
    }
    return results;
  });
}

try {
  if (!flags.dryRun) getCursorApiKey();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

console.log(`Nightly automations for ${GITHUB_REPO}`);
console.log(
  `Tasks: ${[flags.health && "health", flags.vercel && !flags.weekend && "vercel", runSentry && !flags.weekend && "sentry", flags.prs && !flags.weekend && "prs"].filter(Boolean).join(", ") || "(none)"}`,
);
if (!flags.dryRun) console.log(`Agent cap: ${MAX_AGENTS}`);

const errors = [];
for (let i = 0; i < tasks.length; i++) {
  try {
    await tasks[i]();
  } catch (err) {
    errors.push(err.message);
    console.error(`Task failed: ${err.message}`);
  }
  if (!flags.dryRun && launched < MAX_AGENTS && i < tasks.length - 1) {
    await sleep(STAGGER_MS);
  }
}

if (errors.length) {
  console.error(`\nFinished with ${errors.length} error(s).`);
  process.exit(1);
}
console.log(`\nNightly triggers complete. Agents launched: ${launched}${flags.dryRun ? " (dry-run)" : ""}.`);
