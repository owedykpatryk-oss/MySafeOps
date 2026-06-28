#!/usr/bin/env node
/**
 * Checklist for enabling Sentry in MySafeOps (browser SDK + optional source maps).
 * Run: npm run setup:sentry
 */
import dotenv from "dotenv";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const envLocal = resolve(root, ".env.local");
const envExample = resolve(root, ".env.local.example");

function isValidDsn(dsn) {
  const t = String(dsn || "").trim();
  if (!t.startsWith("https://") || !t.includes("@") || !t.includes(".ingest.")) return false;
  try {
    const u = new URL(t);
    const projectId = u.pathname.replace(/^\//, "").split("/")[0];
    return Boolean(u.username && projectId);
  } catch {
    return false;
  }
}

if (existsSync(envLocal)) {
  dotenv.config({ path: envLocal });
}

const dsn = process.env.VITE_SENTRY_DSN || "";
const hasDsn = isValidDsn(dsn);
const hasUpload =
  Boolean(process.env.SENTRY_AUTH_TOKEN?.trim()) &&
  Boolean(process.env.SENTRY_ORG?.trim()) &&
  Boolean(process.env.SENTRY_PROJECT?.trim());

console.log("MySafeOps — Sentry setup\n");
console.log(hasDsn ? "✓ VITE_SENTRY_DSN looks valid in .env.local" : "✗ VITE_SENTRY_DSN missing or invalid");
console.log(
  hasUpload
    ? "✓ Source map upload vars present (SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT)"
    : "○ Source map upload not configured (optional for readable stack traces in prod)"
);

if (!hasDsn) {
  console.log(`
1. Create a project at https://sentry.io — platform: React
2. Copy the **Browser DSN** (public, safe in VITE_*)
3. Add to .env.local:

   VITE_SENTRY_DSN=https://YOUR_KEY@oORG.ingest.REGION.sentry.io/PROJECT_ID

4. For Vercel Production: add the same key in Project → Settings → Environment Variables
5. Redeploy, then trigger a test error (e.g. throw in dev with DSN set) or wait for real traffic

Optional — readable minified stack traces:
   SENTRY_AUTH_TOKEN=sntrys_...   # never commit; CI / local build only
   SENTRY_ORG=your-org-slug
   SENTRY_PROJECT=mysafeops
`);
  if (!existsSync(envLocal) && existsSync(envExample)) {
    console.log("Tip: copy .env.local.example → .env.local first.\n");
  }
  process.exit(hasDsn ? 0 : 1);
}

console.log(`
Sentry is configured locally. After deploy, open:
  https://sentry.io → Issues

Integrated signals:
  · Unhandled React errors (React 19 error handlers + RouteErrorBoundary)
  · Auth / billing breadcrumbs (window.Sentry)
  · React Router v7 navigation tracing
  · Session Replay on errors (prod), text/inputs masked
  · Core Web Vitals as Sentry measurements
`);

process.exit(0);
