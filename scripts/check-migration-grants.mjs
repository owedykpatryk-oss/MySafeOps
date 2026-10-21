#!/usr/bin/env node
// Fails when a migration creates a table or view in `public` without an explicit
// GRANT (or a deliberate REVOKE) for it in the same file.
//
// Why: from 2026-10-30 Supabase no longer grants anon/authenticated/service_role on new
// objects in `public`, so a table without a GRANT is invisible to the Data API (42501).
// https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically
//
// Only migrations at or after CUTOFF are checked; older tables are covered by
// the catch-up migration 20261021090000_explicit_data_api_grants.sql.
//
// Usage: node scripts/check-migration-grants.mjs [migrationsDir]
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CUTOFF = "20261021090000";
const here = path.dirname(fileURLToPath(import.meta.url));
const dir = process.argv[2] || path.join(here, "..", "supabase", "migrations");

const stripComments = (sql) => sql.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ");
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const CREATE_RE = new RegExp(
  String.raw`\bcreate\s+(?:unlogged\s+)?(table|view|materialized\s+view)\s+(?:if\s+not\s+exists\s+)?(?:"?([a-z_][a-z0-9_]*)"?\s*\.\s*)?"?([a-z_][a-z0-9_]*)"?`,
  "gi",
);

export function findMissingGrants(sql) {
  const text = stripComments(sql);
  if (/\bgrant\s+[^;]*\bon\s+all\s+tables\s+in\s+schema\s+[^;]*\bpublic\b/i.test(text)) return [];
  const missing = [];
  for (const m of text.matchAll(CREATE_RE)) {
    const schema = (m[2] || "public").toLowerCase();
    if (schema !== "public") continue;
    const name = m[3].toLowerCase();
    const target = String.raw`(?:table\s+)?(?:"?public"?\s*\.\s*)?"?${escapeRe(name)}"?(?![a-z0-9_])`;
    const granted = new RegExp(String.raw`\b(grant|revoke)\s+[^;]*?\bon\s+(?:[^;]*?,\s*)?${target}[^;]*\b(to|from)\b`, "i");
    if (!granted.test(text)) missing.push(`${m[1].toLowerCase().replace(/\s+/g, " ")} public.${name}`);
  }
  return missing;
}

function main() {
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const problems = [];
  for (const file of files) {
    const version = file.split("_")[0];
    if (version.padEnd(14, "0") < CUTOFF) continue;
    for (const obj of findMissingGrants(readFileSync(path.join(dir, file), "utf8"))) {
      problems.push(`${file}: ${obj} has no explicit GRANT/REVOKE in this migration`);
    }
  }
  if (problems.length) {
    console.error("Missing explicit Data API grants (Supabase 2026-10-30 change):");
    for (const p of problems) console.error(`  - ${p}`);
    console.error("Add e.g.: grant select, insert, update, delete on table public.<name> to authenticated, service_role;");
    console.error("(anon only when an RLS policy is meant for it; RLS must be enabled.)");
    process.exit(1);
  }
  console.log(`check-migration-grants: OK (${files.length} migrations scanned, cutoff ${CUTOFF})`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
