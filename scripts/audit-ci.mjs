/**
 * CI audit gate — fail on high/critical in production dependencies unless GHSA is allowlisted.
 *
 * Uses `npm audit --omit=dev` so eslint/sentry/minimatch transitive DoS advisories (dev-only)
 * do not fail the pipeline. Prefer version bumps for anything that ships to browsers.
 */
import { execSync } from "node:child_process";

/** @type {Record<string, string>} */
const ALLOWLIST = {
  // react-router RSC CSRF — MySafeOps uses BrowserRouter SPA only (App.jsx), not RSC mode.
  "GHSA-qwww-vcr4-c8h2": "SPA BrowserRouter only; advisory is RSC-mode specific",
};

function collectHighFindings(audit) {
  const vulns = audit?.vulnerabilities || {};
  /** @type {{ name: string; severity: string; via: string[] }[]} */
  const out = [];
  for (const [name, info] of Object.entries(vulns)) {
    const severity = String(info?.severity || "");
    if (severity !== "high" && severity !== "critical") continue;
    const via = [];
    for (const v of info.via || []) {
      if (typeof v === "string") via.push(v);
      else if (v?.url) {
        const m = String(v.url).match(/GHSA-[\w-]+/);
        via.push(m ? m[0] : v.url);
      } else if (v?.source) via.push(String(v.source));
    }
    out.push({ name, severity, via });
  }
  return out;
}

function runAuditJson(args) {
  try {
    return execSync(`npm audit ${args} --json`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 20 * 1024 * 1024,
    });
  } catch (e) {
    const raw = e.stdout?.toString?.() || "";
    if (!raw) {
      console.error(`npm audit ${args} failed with no JSON output`);
      process.exit(1);
    }
    return raw;
  }
}

function main() {
  // Production tree only — red CI must reflect shipped risk, not eslint DoS in CI runners.
  const raw = runAuditJson("--omit=dev");
  let audit;
  try {
    audit = JSON.parse(raw);
  } catch {
    console.error("Could not parse npm audit JSON");
    process.exit(1);
  }

  const highs = collectHighFindings(audit);
  const blocking = [];
  const allowed = [];

  for (const finding of highs) {
    const ghsaHits = finding.via.filter((v) => String(v).startsWith("GHSA-"));
    const allAllowed =
      ghsaHits.length > 0 && ghsaHits.every((id) => Object.prototype.hasOwnProperty.call(ALLOWLIST, id));
    if (allAllowed) {
      allowed.push(finding);
      continue;
    }
    if (finding.name === "react-router-dom" || finding.name === "react-router") {
      if (ALLOWLIST["GHSA-qwww-vcr4-c8h2"]) {
        allowed.push(finding);
        continue;
      }
    }
    blocking.push(finding);
  }

  if (allowed.length) {
    console.log("Allowlisted production high/critical findings:");
    for (const f of allowed) {
      console.log(`  - ${f.severity} ${f.name} (${f.via.join(", ") || "n/a"})`);
    }
    for (const [id, reason] of Object.entries(ALLOWLIST)) {
      console.log(`  ${id}: ${reason}`);
    }
  }

  if (blocking.length) {
    console.error("Blocking production high/critical vulnerabilities:");
    for (const f of blocking) {
      console.error(`  - ${f.severity} ${f.name} via ${f.via.join(", ") || "n/a"}`);
    }
    process.exit(1);
  }

  console.log("npm audit CI gate passed (production tree; no unallowlisted high/critical).");
}

main();
