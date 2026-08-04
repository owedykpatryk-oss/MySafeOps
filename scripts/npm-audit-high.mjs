#!/usr/bin/env node
/**
 * CI / security-doctor gate for `npm audit --audit-level=high`.
 *
 * Filters known stale GHSA entries when the installed tree already meets the
 * upstream patched range (npm advisory DB can lag remix-run's own advisory).
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const require = createRequire(import.meta.url);

/** @type {{ id: string, reason: string, isSatisfied: () => boolean }[]} */
const ALLOWLIST = [
  {
    id: "GHSA-qwww-vcr4-c8h2",
    reason:
      "Upstream patched react-router@7.18.2 / 8.3.0 (RSC-only). GHSA still lists >=7.12.0 <8.3.0. App uses BrowserRouter, not unstable RSC APIs.",
    isSatisfied() {
      let version;
      try {
        version = require(resolve(root, "node_modules/react-router/package.json")).version;
      } catch {
        return false;
      }
      return isReactRouterPatchedForGhsaQwww(version);
    },
  },
];

/**
 * Upstream (remix-run) advisory ranges:
 * - patched >=7.18.2 (within v7)
 * - patched >=8.3.0 (within v8)
 * @param {string} version
 */
export function isReactRouterPatchedForGhsaQwww(version) {
  const parts = String(version || "")
    .split(".")
    .map((p) => Number.parseInt(p, 10));
  if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return false;
  const [major, minor, patch] = parts;
  if (major === 7) return minor > 18 || (minor === 18 && patch >= 2);
  if (major === 8) return minor >= 3;
  if (major > 8) return true;
  return false;
}

function collectAdvisoryIds(vuln) {
  const ids = new Set();
  for (const entry of vuln.via || []) {
    if (typeof entry === "string") continue;
    const url = entry.url || "";
    const m = url.match(/GHSA-[a-z0-9-]+/i);
    if (m) ids.add(m[0].toUpperCase());
  }
  return ids;
}

function main() {
  const audit = spawnSync("npm", ["audit", "--json"], {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32",
    maxBuffer: 20 * 1024 * 1024,
  });

  let report;
  try {
    report = JSON.parse(audit.stdout || "{}");
  } catch {
    console.error("npm audit produced unreadable JSON");
    console.error(audit.stderr || audit.stdout || "");
    process.exit(1);
  }

  const vulns = report.vulnerabilities || {};
  const activeAllow = ALLOWLIST.filter((a) => a.isSatisfied());
  const activeIds = new Set(activeAllow.map((a) => a.id.toUpperCase()));

  /** @type {string[]} */
  const remaining = [];
  /** @type {string[]} */
  const ignored = [];

  for (const [name, vuln] of Object.entries(vulns)) {
    const severity = String(vuln.severity || "").toLowerCase();
    if (severity !== "high" && severity !== "critical") continue;

    const ids = collectAdvisoryIds(vuln);
    const onlyAllowlisted =
      ids.size > 0 && [...ids].every((id) => activeIds.has(id));
    // react-router-dom is often "via": ["react-router"] with no GHSA url —
    // treat high findings that only exist as effects of allowlisted advisories.
    const viaOnlyAllowlistedParent =
      Array.isArray(vuln.via) &&
      vuln.via.length > 0 &&
      vuln.via.every((v) => {
        if (typeof v !== "string" || !vulns[v]) return false;
        const parentIds = collectAdvisoryIds(vulns[v]);
        return parentIds.size > 0 && [...parentIds].every((id) => activeIds.has(id));
      });

    if (onlyAllowlisted || viaOnlyAllowlistedParent) {
      ignored.push(`${name} (${severity})${ids.size ? ` [${[...ids].join(", ")}]` : ""}`);
      continue;
    }
    remaining.push(
      `${name} (${severity})${ids.size ? ` [${[...ids].join(", ")}]` : ""}`,
    );
  }

  if (ignored.length) {
    console.log("npm audit high/critical allowlisted (justified):");
    for (const line of ignored) console.log(`  · ${line}`);
    for (const a of activeAllow) {
      console.log(`  · ${a.id}: ${a.reason}`);
    }
    console.log("");
  }

  if (remaining.length) {
    console.error("npm audit high/critical findings:");
    for (const line of remaining) console.error(`  · ${line}`);
    console.error("\nRun `npm audit` for full details.");
    process.exit(1);
  }

  console.log("npm audit — no actionable high/critical advisories");
  process.exit(0);
}

const isDirect = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirect) main();
