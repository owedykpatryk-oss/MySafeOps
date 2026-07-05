#!/usr/bin/env node
/**
 * Shared helpers for Cursor Cloud Agents API (v1).
 * Docs: https://cursor.com/docs/cloud-agent/api/endpoints
 */
import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
export const ROOT = resolve(__dirname, "..");
export const PROMPTS_DIR = join(ROOT, ".cursor/automations");
export const DEFAULT_REPO = "https://github.com/owedykpatryk-oss/MySafeOps";
const API_BASE = "https://api.cursor.com/v1";

export const AGENT_TYPES = {
  "ci-fix": "ci-auto-fix.prompt.md",
  mobile: "mobile-webhook.prompt.md",
  slack: "slack-fix.prompt.md",
  sentry: "sentry-auto-fix.prompt.md",
  "daily-health": "daily-health.prompt.md",
  "pr-review": "pr-review.prompt.md",
  "pr-fix": "pr-fix-command.prompt.md",
  vercel: "vercel-deploy.prompt.md",
  billing: "billing-auto-fix.prompt.md",
};

export function loadCursorEnv() {
  config({ path: resolve(ROOT, ".env.local") });
  config({ path: resolve(ROOT, ".env") });
}

export function getCursorApiKey() {
  const key = process.env.CURSOR_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "Missing CURSOR_API_KEY. Cursor Dashboard → Integrations → API Keys → add to .env.local",
    );
  }
  return key;
}

export function loadPrompt(type) {
  const file = AGENT_TYPES[type];
  if (!file) {
    throw new Error(`Unknown agent type "${type}". Valid: ${Object.keys(AGENT_TYPES).join(", ")}`);
  }
  return readFileSync(join(PROMPTS_DIR, file), "utf8").trim();
}

/**
 * @param {object} opts
 * @param {string} opts.promptText
 * @param {string} [opts.name]
 * @param {string} [opts.repoUrl]
 * @param {string} [opts.startingRef]
 * @param {string} [opts.prUrl]
 * @param {boolean} [opts.autoCreatePR]
 * @param {string} [opts.apiKey]
 */
export async function createCloudAgent({
  promptText,
  name,
  repoUrl = DEFAULT_REPO,
  startingRef = "main",
  prUrl,
  autoCreatePR = true,
  apiKey,
}) {
  const key = apiKey ?? getCursorApiKey();
  const repos = [{ url: repoUrl }];
  if (prUrl) repos[0].prUrl = prUrl;
  else repos[0].startingRef = startingRef;

  const body = {
    prompt: { text: promptText },
    repos,
    autoCreatePR,
  };
  if (name) body.name = name.slice(0, 100);

  const res = await fetch(`${API_BASE}/agents`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}`,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON error body */
  }

  if (!res.ok) {
    const detail = json?.error?.message ?? json?.message ?? text;
    throw new Error(`Cursor API ${res.status}: ${detail}`);
  }
  return json;
}

/**
 * @param {string} agentId
 * @param {string} [apiKey]
 */
export async function getCloudAgent(agentId, apiKey) {
  const key = apiKey ?? getCursorApiKey();
  const res = await fetch(`${API_BASE}/agents/${encodeURIComponent(agentId)}`, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}`,
    },
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON */
  }
  if (!res.ok) {
    const detail = json?.error?.message ?? json?.message ?? text;
    throw new Error(`Cursor API ${res.status}: ${detail}`);
  }
  return json;
}
