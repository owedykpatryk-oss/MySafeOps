#!/usr/bin/env node
/**
 * Extend MySafeOps evaluation trial (+14 days) for Utility Mapping tenants.
 *
 * Requires (MySafeOps project burgpzankkqvpcmdkhro — NOT MyPitLab):
 *   SUPABASE_URL or VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Run: npm run billing:extend-utility-mapping-trial
 * GitHub Actions: workflow "Apply Utility Mapping trial" (needs repo secrets).
 */
import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
config({ path: resolve(__dirname, "../.env.local") });
config({ path: resolve(__dirname, "../.env") });

const MYSAFEOPS_PROJECT_HOST = "burgpzankkqvpcmdkhro.supabase.co";
const UM_SLUGS = [
  "utility-mapping",
  "u-map",
  "umap",
  "utility-mapping-group",
  "patryk-44bdf196",
];
const UMAP_DOMAIN = "u-map.co.uk";
const TRIAL_DAYS = 14;

const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim().replace(/\/$/, "");
const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const applySql = process.argv.includes("--sql");

if (!url || !serviceKey) {
  console.error("Missing SUPABASE_URL/VITE_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY.");
  console.error(`Target must be MySafeOps (${MYSAFEOPS_PROJECT_HOST}).`);
  process.exit(1);
}

let host = "";
try {
  host = new URL(url).host;
} catch {
  console.error("Invalid SUPABASE_URL:", url);
  process.exit(1);
}

if (host !== MYSAFEOPS_PROJECT_HOST) {
  console.error(`Refusing to run: SUPABASE_URL host is ${host}, expected ${MYSAFEOPS_PROJECT_HOST}.`);
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function trialEndsAtIso() {
  return new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

async function listUmapOrgIds() {
  const ids = new Set();
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    for (const u of data?.users || []) {
      const email = String(u.email || "").trim().toLowerCase();
      const domain = email.split("@")[1] || "";
      if (domain === UMAP_DOMAIN) ids.add(u.id);
    }
    if (!data?.users?.length || data.users.length < 200) break;
    page += 1;
  }
  if (!ids.size) return [];

  const { data: mems, error: memErr } = await admin
    .from("org_memberships")
    .select("org_id")
    .in("user_id", [...ids]);
  if (memErr) throw memErr;
  return [...new Set((mems || []).map((m) => m.org_id).filter(Boolean))];
}

async function extendByRest() {
  const endsAt = trialEndsAtIso();
  const updated = [];

  for (const slug of UM_SLUGS) {
    const { data, error } = await admin
      .from("organizations")
      .update({ trial_ends_at: endsAt })
      .eq("slug", slug)
      .select("id, slug, trial_ends_at");
    if (error) throw error;
    if (data?.length) updated.push(...data);
  }

  const orgIds = await listUmapOrgIds();
  if (orgIds.length) {
    const { data, error } = await admin
      .from("organizations")
      .update({ trial_ends_at: endsAt })
      .in("id", orgIds)
      .select("id, slug, trial_ends_at");
    if (error) throw error;
    for (const row of data || []) {
      if (!updated.some((u) => u.id === row.id)) updated.push(row);
    }
  }

  return updated;
}

async function extendBySqlFile() {
  const sqlPath = resolve(__dirname, "../supabase/migrations/20260817130000_utility_mapping_trial_extension.sql");
  const sql = readFileSync(sqlPath, "utf8");
  const accessToken = (process.env.SUPABASE_ACCESS_TOKEN || "").trim();
  if (!accessToken) {
    console.error("--sql requires SUPABASE_ACCESS_TOKEN (Supabase account → Access Tokens).");
    process.exit(1);
  }
  const ref = MYSAFEOPS_PROJECT_HOST.split(".")[0];
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error("Supabase Management API error:", res.status, text.slice(0, 500));
    process.exit(1);
  }
  return text;
}

async function main() {
  console.log(`MySafeOps trial extension (+${TRIAL_DAYS}d) for Utility Mapping…\n`);

  if (applySql) {
    const out = await extendBySqlFile();
    console.log(out);
    console.log("\nDone (SQL migration file applied via Management API).");
    return;
  }

  const rows = await extendByRest();
  if (!rows.length) {
    console.warn("No organisations updated — check slugs / @u-map.co.uk memberships.");
    process.exit(1);
  }

  console.log("Updated organisations:");
  for (const r of rows) {
    console.log(`  • ${r.slug} → trial_ends_at ${r.trial_ends_at}`);
  }
  console.log("\nDone. Sign out/in on the Utility Mapping workspace to refresh billing cache.");
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});
