/**
 * Production build identity.
 *
 * Vite stamps <meta name="build-sha"> into index.html. Production Smoke reads
 * that tag from https://www.mysafeops.com/ and compares it to main.
 * No runtime dependency — Node builtins only.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

export const PRODUCTION_SITE_URL = "https://www.mysafeops.com/";
export const BUILD_SHA_MISMATCH_HINT = "possible manual CLI deploy or stale alias";
export const BUILD_SHA_DIRTY_HINT =
  "the build modified tracked files (e.g. a generator wrote a file during the build) or a manual CLI deploy came from an uncommitted local copy";

const SHA_RE = /^[0-9a-f]{7,40}$/;
const DEFAULT_RETRY_MS = 4 * 60 * 1000;
const DEFAULT_INTERVAL_MS = 15 * 1000;
const FETCH_TIMEOUT_MS = 20 * 1000;
const MAX_LOGGED_CHANGES = 20;

/**
 * @param {string} value
 * @returns {string} lowercase sha, sha-dirty, or "unknown"
 */
export function sanitizeBuildSha(value) {
  const raw = String(value || "")
    .trim()
    .toLowerCase();
  if (raw === "unknown") return "unknown";
  const dirty = raw.endsWith("-dirty");
  const base = dirty ? raw.slice(0, -"-dirty".length) : raw;
  if (!SHA_RE.test(base)) return "unknown";
  return dirty ? `${base}-dirty` : base;
}

/**
 * @param {string} sha
 */
export function buildShaMetaTag(sha) {
  return `<meta name="build-sha" content="${sanitizeBuildSha(sha)}" />`;
}

/**
 * Insert the build-sha meta tag before </head>. Leaves HTML unchanged when
 * the tag is already present or there is no head.
 * @param {string} html
 * @param {string} sha
 */
export function injectBuildShaMeta(html, sha) {
  const source = String(html || "");
  if (/<meta\b[^>]*\bname\s*=\s*["']build-sha["']/i.test(source)) return source;
  if (!/<\/head>/i.test(source)) return source;
  return source.replace(/<\/head>/i, `    ${buildShaMetaTag(sha)}\n  </head>`);
}

/**
 * Prefer VERCEL_GIT_COMMIT_SHA (Vercel Git deployments). Fall back to
 * `git rev-parse HEAD`. Append `-dirty` when `git status` shows uncommitted
 * changes. CLI uploads with no git metadata resolve to `unknown`.
 *
 * When the build is marked dirty, the offending `git status --porcelain` lines
 * (file paths only) are logged so the cause is visible in the Vercel build log.
 *
 * @param {{
 *   env?: NodeJS.ProcessEnv,
 *   runGit?: (args: string[]) => string,
 *   log?: (line: string) => void,
 * }} [opts]
 */
export function resolveBuildCommitSha({
  env = process.env,
  runGit = defaultRunGit,
  log = (line) => console.warn(line),
} = {}) {
  const fromVercel = readShaToken(env.VERCEL_GIT_COMMIT_SHA);
  const sha = fromVercel || readGitHead(runGit);
  if (!sha) return "unknown";
  const changes = workingTreeChanges(runGit);
  if (changes.length > 0) {
    const shown = changes.slice(0, MAX_LOGGED_CHANGES);
    const more = changes.length - shown.length;
    log(
      `[build-sha] Marking build ${sha} dirty; git status --porcelain reports:\n` +
        shown.map((line) => `  ${line}`).join("\n") +
        (more > 0 ? `\n  ... and ${more} more` : "")
    );
    return `${sha}-dirty`;
  }
  return sha;
}

/**
 * @param {string} html
 * @returns {string} content of the build-sha meta tag, or "" when missing
 */
export function extractBuildSha(html) {
  const source = String(html || "");
  const tags = source.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const name = readMetaAttr(tag, "name");
    if (name.toLowerCase() !== "build-sha") continue;
    return readMetaAttr(tag, "content").trim();
  }
  return "";
}

/**
 * @param {string} served
 * @param {string} expected
 * @returns {{ ok: boolean, reason: "match" | "missing" | "dirty" | "mismatch", message: string }}
 */
export function assessProductionHtml(served, expected) {
  const expectedSha = String(expected || "").trim();
  const servedSha = String(served || "").trim();
  const hint = BUILD_SHA_MISMATCH_HINT;
  if (!servedSha) {
    return {
      ok: false,
      reason: "missing",
      message: `Production build-sha is missing (expected ${expectedSha || "(none)"}, served none). ${hint}`,
    };
  }
  if (servedSha.toLowerCase().endsWith("-dirty")) {
    return {
      ok: false,
      reason: "dirty",
      message: `Production build-sha is dirty (expected ${expectedSha}, served ${servedSha}). ${BUILD_SHA_DIRTY_HINT}`,
    };
  }
  if (servedSha.toLowerCase() !== expectedSha.toLowerCase()) {
    return {
      ok: false,
      reason: "mismatch",
      message: `Production build-sha mismatch (expected ${expectedSha}, served ${servedSha}). ${hint}`,
    };
  }
  return {
    ok: true,
    reason: "match",
    message: `Production build-sha matches ${expectedSha}.`,
  };
}

/**
 * Which commit production should be serving for this workflow run.
 *
 * - Successful Production deployment of main: GITHUB_SHA.
 *   Vercel sets deployment.ref to the commit SHA, so "of main" means that SHA
 *   equals origin/main, or ref is literally main.
 * - schedule and workflow_dispatch: origin/main.
 * - Any other deployment_status (preview, in progress, failed): do not run.
 * - Successful Production deployment of some other SHA: do not run. Comparing
 *   it to GITHUB_SHA would pass a non-main alias; comparing it to origin/main
 *   flakes when a newer commit is already deploying. The scheduled run is the
 *   check that production is still current main.
 *
 * @param {{
 *   eventName?: string,
 *   githubSha?: string,
 *   originMainSha?: string,
 *   deploymentRef?: string,
 *   deploymentEnvironment?: string,
 *   deploymentState?: string,
 * }} [input]
 */
export function selectExpectedBuildSha({
  eventName = "",
  githubSha = "",
  originMainSha = "",
  deploymentRef = "",
  deploymentEnvironment = "",
  deploymentState = "",
} = {}) {
  const main = String(originMainSha || "").trim();
  const sha = String(githubSha || "").trim();
  if (eventName === "deployment_status") {
    const environment = String(deploymentEnvironment || "");
    const state = String(deploymentState || "");
    const ref = String(deploymentRef || "");
    const isProduction = environment.toLowerCase() === "production";
    const isSuccess = state === "success";
    if (!isProduction || !isSuccess) {
      return {
        run: false,
        expectedSha: "",
        source: "",
        message: `Skipping production smoke for deployment_status (environment ${environment || "unknown"}, state ${state || "unknown"}).`,
      };
    }
    const refIsMain = ref === "main" || ref === "refs/heads/main";
    const deployedIsMain = Boolean(sha && main && sha.toLowerCase() === main.toLowerCase());
    if (refIsMain || deployedIsMain) {
      if (!sha) {
        return {
          run: true,
          expectedSha: "",
          source: "GITHUB_SHA",
          message: "GITHUB_SHA is empty for a deployment of main.",
        };
      }
      return {
        run: true,
        expectedSha: sha,
        source: "GITHUB_SHA",
        message: `Expected SHA is GITHUB_SHA (${sha}) for this deployment of main.`,
      };
    }
    return {
      run: false,
      expectedSha: "",
      source: "",
      message: `Skipping build-sha smoke: Production deployment ${sha || "(none)"} (ref ${ref || "none"}) is not origin/main (${main || "unknown"}). The scheduled run checks current main.`,
    };
  }
  return {
    run: true,
    expectedSha: main,
    source: "origin/main",
    message: `Expected SHA is origin/main (${main || "(none)"}) for ${eventName || "this"} run.`,
  };
}

/**
 * Fetch production HTML and compare build-sha, retrying so a rollout that
 * has not finished aliasing yet does not fail the job.
 *
 * @param {{
 *   expectedSha: string,
 *   url?: string,
 *   retryMs?: number,
 *   intervalMs?: number,
 *   fetchImpl?: typeof fetch,
 *   sleep?: (ms: number) => Promise<void>,
 *   now?: () => number,
 *   log?: (line: string) => void,
 * }} opts
 */
export async function runProductionBuildShaCheck({
  expectedSha,
  url = PRODUCTION_SITE_URL,
  retryMs = DEFAULT_RETRY_MS,
  intervalMs = DEFAULT_INTERVAL_MS,
  fetchImpl = globalThis.fetch,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now = () => Date.now(),
  log = (line) => console.log(line),
}) {
  const expected = String(expectedSha || "").trim();
  if (!expected) {
    return {
      ok: false,
      attempts: 0,
      message: `Production build-sha check has no expected SHA (expected none, served none). ${BUILD_SHA_MISMATCH_HINT}`,
    };
  }

  const deadline = now() + Math.max(0, Number(retryMs) || 0);
  let attempts = 0;
  let lastMessage = `Production build-sha check did not run (expected ${expected}, served none). ${BUILD_SHA_MISMATCH_HINT}`;

  for (;;) {
    if (now() > deadline && attempts > 0) break;
    attempts += 1;
    try {
      const html = await fetchProductionHtml(url, fetchImpl, now);
      const served = extractBuildSha(html);
      const result = assessProductionHtml(served, expected);
      if (result.ok) return { ...result, attempts };
      lastMessage = result.message;
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      lastMessage = `Production build-sha check could not read ${url} (${detail}). expected ${expected}, served none. ${BUILD_SHA_MISMATCH_HINT}`;
    }
    const remaining = deadline - now();
    if (remaining <= 0) break;
    log(
      `build-sha attempt ${attempts} did not match yet; retrying for ${Math.ceil(remaining / 1000)}s. ${lastMessage}`
    );
    await sleep(Math.min(Math.max(0, Number(intervalMs) || 0), remaining));
  }

  return { ok: false, attempts, message: lastMessage };
}

/**
 * @param {string} url
 * @param {typeof fetch} fetchImpl
 * @param {() => number} now
 */
async function fetchProductionHtml(url, fetchImpl, now) {
  const target = new URL(url);
  target.searchParams.set("build_sha_check", String(now()));
  const response = await fetchImpl(target, {
    redirect: "follow",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: {
      Accept: "text/html",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      "User-Agent": "MySafeOpsProductionSmoke/1.0",
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.text();
}

/**
 * @param {string[]} args
 */
function defaultRunGit(args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    timeout: 15000,
  });
}

/**
 * @param {unknown} value
 */
function readShaToken(value) {
  const token = String(value || "")
    .trim()
    .toLowerCase();
  return SHA_RE.test(token) ? token : "";
}

/**
 * @param {(args: string[]) => string} runGit
 */
function readGitHead(runGit) {
  try {
    return readShaToken(runGit(["rev-parse", "HEAD"]));
  } catch {
    return "";
  }
}

/**
 * Ignored files (node_modules, dist) are not changes. A lockfile-only diff is
 * also ignored: Vercel runs `npm install` before Vite, and that can touch
 * package-lock.json without any source change. If git is not available, the
 * tree is treated as clean so a Git deployment that only has
 * VERCEL_GIT_COMMIT_SHA still stamps that SHA.
 * @param {(args: string[]) => string} runGit
 * @returns {string[]} porcelain lines that make the tree dirty
 */
function workingTreeChanges(runGit) {
  try {
    const lines = String(runGit(["status", "--porcelain"]) || "")
      .split("\n")
      .map((line) => line.trimEnd())
      .filter(Boolean);
    return lines.filter((line) => !isInstallArtifact(porcelainPath(line)));
  } catch {
    return [];
  }
}

/**
 * @param {string} line
 */
function porcelainPath(line) {
  const body = line.length > 3 ? line.slice(3).trim() : line.trim();
  const renamed = body.split(" -> ");
  return renamed[renamed.length - 1].replace(/^"|"$/g, "");
}

/**
 * @param {string} filePath
 */
function isInstallArtifact(filePath) {
  return filePath === "package-lock.json";
}

/**
 * @param {string} tag
 * @param {string} attr
 */
function readMetaAttr(tag, attr) {
  const re = new RegExp(`\\b${attr}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>]+))`, "i");
  const match = tag.match(re);
  if (!match) return "";
  return match[1] ?? match[2] ?? match[3] ?? "";
}

function invokedDirectly() {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(entry).href;
}

function writeGithubOutput(key, value) {
  const line = `${key}=${String(value).replace(/\r?\n/g, " ")}\n`;
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, line);
    return;
  }
  process.stdout.write(line);
}

async function main() {
  const command = process.argv[2];
  if (command === "--print-expected") {
    const selected = selectExpectedBuildSha({
      eventName: process.env.EVENT_NAME || "",
      githubSha: process.env.GITHUB_SHA || "",
      originMainSha: process.env.ORIGIN_MAIN_SHA || "",
      deploymentRef: process.env.DEPLOYMENT_REF || "",
      deploymentEnvironment: process.env.DEPLOYMENT_ENVIRONMENT || "",
      deploymentState: process.env.DEPLOYMENT_STATE || "",
    });
    writeGithubOutput("run", selected.run ? "true" : "false");
    writeGithubOutput("sha", selected.expectedSha);
    writeGithubOutput("source", selected.source);
    console.log(selected.message);
    if (selected.run && !selected.expectedSha) {
      console.error(`::error::${selected.message}`);
      process.exit(1);
    }
    if (!selected.run) {
      console.log(`::notice::${selected.message}`);
    }
    return;
  }

  if (command === "--check") {
    const result = await runProductionBuildShaCheck({
      expectedSha: process.env.EXPECTED_BUILD_SHA || "",
      url: process.env.PRODUCTION_BUILD_SHA_URL || PRODUCTION_SITE_URL,
      retryMs: Number(process.env.BUILD_SHA_RETRY_MS ?? DEFAULT_RETRY_MS),
      intervalMs: Number(process.env.BUILD_SHA_INTERVAL_MS ?? DEFAULT_INTERVAL_MS),
    });
    if (result.ok) {
      console.log(result.message);
      return;
    }
    console.error(`::error::${result.message}`);
    process.exit(1);
  }

  console.error("Usage: node scripts/productionBuildSha.mjs --print-expected|--check");
  process.exit(1);
}

if (invokedDirectly()) {
  main().catch((err) => {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`::error::${detail}`);
    process.exit(1);
  });
}
