#!/usr/bin/env node
/**
 * Mass-import array-shaped keys from a MySafeOps backup JSON into D1 (org_sync_kv).
 *
 * Flow (manual / CI-safe — no service role in repo):
 * 1. Export backup from the app (Settings → Backup) or use an existing `bundle.json`
 *    with shape `{ version?: 1, keys: { "mysafeops_workers_<org>": "[...]", ... } }`.
 * 2. Obtain a Supabase **user** JWT (short-lived): e.g. from browser devtools after sign-in,
 *    or your own OAuth flow — do not commit tokens.
 * 3. Run:
 *      D1_IMPORT_JWT="<access_token>" D1_IMPORT_ORG_SLUG="<slug>" \\
 *        node scripts/d1-import-backup.mjs --file path/to/backup.json
 *
 * Env:
 *   VITE_D1_API_URL — Worker base (from .env.local via dotenv)
 *   D1_IMPORT_JWT   — Bearer token (required)
 *   D1_IMPORT_ORG_SLUG — must match keys suffix in backup, e.g. keys ending `_acme-corp`
 *
 * Flags:
 *   --file <path>   (required) backup JSON
 *   --dry-run       list actions only
 *
 * Only namespaces in D1_KNOWN_NAMESPACES are uploaded (same names as useD1OrgArraySync).
 */
import dotenv from "dotenv";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const envLocal = resolve(root, ".env.local");
if (existsSync(envLocal)) dotenv.config({ path: envLocal });

const D1_KNOWN_NAMESPACES = new Set([
  "mysafeops_workers",
  "mysafeops_projects",
  "permits_v2",
  "rams_builder_docs",
  "method_statements",
  "toolbox_talks",
  "snags",
  "mysafeops_incidents",
  "incident_actions_v1",
  "training_matrix",
  "inspection_records",
  "gate_book",
  "daily_briefings",
  "visitor_log",
  "welfare_check_log",
  "ladder_inspections",
  "water_hygiene_log",
  "environmental_log",
  "waste_register",
  "mewp_log",
]);

function parseArgs() {
  const argv = process.argv.slice(2);
  let file = "";
  let dryRun = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--file" && argv[i + 1]) {
      file = argv[++i];
    } else if (argv[i] === "--dry-run") {
      dryRun = true;
    }
  }
  return { file, dryRun };
}

async function putKv(base, jwt, orgSlug, namespace, dataKey, value) {
  const res = await fetch(`${base}/v1/kv`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "X-Org-Slug": orgSlug,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ namespace, key: dataKey, value }),
  });
  const body = await res.json().catch(() => ({}));
  const rid = res.headers.get("x-request-id") || res.headers.get("X-Request-Id") || "";
  return { ok: res.ok, status: res.status, body, rid };
}

async function main() {
  const { file, dryRun } = parseArgs();
  const base = String(process.env.VITE_D1_API_URL || "")
    .trim()
    .replace(/\/+$/, "");
  const jwt = String(process.env.D1_IMPORT_JWT || "").trim();
  const orgSlug = String(process.env.D1_IMPORT_ORG_SLUG || "").trim();

  if (!file) {
    console.error("d1:import-backup — missing --file <backup.json>\n");
    process.exit(1);
  }
  if (!base) {
    console.error("d1:import-backup — VITE_D1_API_URL is empty.\n");
    process.exit(1);
  }
  if (!jwt) {
    console.error("d1:import-backup — set D1_IMPORT_JWT (Supabase user access token).\n");
    process.exit(1);
  }
  if (!orgSlug || orgSlug === "default") {
    console.error("d1:import-backup — set D1_IMPORT_ORG_SLUG to the organisation slug (not default).\n");
    process.exit(1);
  }

  const raw = readFileSync(resolve(process.cwd(), file), "utf8");
  let bundle;
  try {
    bundle = JSON.parse(raw);
  } catch (e) {
    console.error(`d1:import-backup — invalid JSON: ${e?.message || e}\n`);
    process.exit(1);
  }
  if (!bundle?.keys || typeof bundle.keys !== "object" || Array.isArray(bundle.keys)) {
    console.error('d1:import-backup — backup must contain object "keys".\n');
    process.exit(1);
  }

  const suffix = `_${orgSlug}`;
  const planned = [];

  for (const [storageKey, rawVal] of Object.entries(bundle.keys)) {
    if (typeof rawVal !== "string") continue;
    if (!storageKey.endsWith(suffix)) continue;
    const ns = storageKey.slice(0, -suffix.length);
    if (!D1_KNOWN_NAMESPACES.has(ns)) continue;
    let parsed;
    try {
      parsed = JSON.parse(rawVal);
    } catch {
      continue;
    }
    if (!Array.isArray(parsed)) continue;
    planned.push({ namespace: ns, dataKey: "main", itemCount: parsed.length, value: parsed });
  }

  if (planned.length === 0) {
    console.error(
      `d1:import-backup — no matching array keys for org "${orgSlug}" and known namespaces.\n` +
        `Expected keys like: mysafeops_workers_${orgSlug}\n`
    );
    process.exit(1);
  }

  console.log(`d1:import-backup — ${dryRun ? "DRY RUN" : "upload"} → ${base} org=${orgSlug} keys=${planned.length}`);
  for (const p of planned) {
    console.log(`  • ${p.namespace} / ${p.dataKey} (${p.itemCount} items)`);
  }
  if (dryRun) {
    console.log("d1:import-backup — dry run complete.\n");
    return;
  }

  for (const p of planned) {
    const r = await putKv(base, jwt, orgSlug, p.namespace, p.dataKey, p.value);
    if (!r.ok) {
      console.error(`d1:import-backup — FAILED ${p.namespace}: HTTP ${r.status}`, r.body, r.rid ? `rid=${r.rid}` : "");
      process.exit(1);
    }
    console.log(`d1:import-backup — OK ${p.namespace} version=${r.body.version ?? "?"} ${r.rid ? `rid=${r.rid}` : ""}`);
  }
  console.log("d1:import-backup — done.\n");
}

main().catch((e) => {
  console.error(`d1:import-backup — ${e?.message || e}\n`);
  process.exit(1);
});
