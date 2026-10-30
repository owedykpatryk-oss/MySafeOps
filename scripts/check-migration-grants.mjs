#!/usr/bin/env node
// Checks that every migration at or after CUTOFF which creates a table or view in `public`
// also, in the same file:
//   1. grants it to service_role (GRANT ... ON <name> ... TO service_role),
//   2. enables RLS on a table that it grants to anon/authenticated/public,
//   3. sets security_invoker on a view that it grants to anon/authenticated/public. This is
//      checked per view: `with (security_invoker = true)` in that view's own CREATE statement, or
//      `ALTER VIEW <name> SET (security_invoker = true)`; another view's setting does not count.
// RLS state is the LAST `ALTER TABLE <t> ENABLE|DISABLE ROW LEVEL SECURITY` in the file, so a later
// DISABLE after an ENABLE fails the check.
// `GRANT ... ON ALL TABLES IN SCHEMA public` only counts for tables created earlier in the
// same file. Tables created with dynamic SQL (EXECUTE format('create table ...')) cannot be
// resolved statically: the file must carry the marker comment
//   -- check-migration-grants: dynamic-reviewed
// after a human checked those grants.
// Known limitation: `EXECUTE <variable>` / `EXECUTE format(<variable>, ...)` / `EXECUTE '...' || x`
// build SQL at run time, so the objects they create cannot be analysed. The check does not guess:
// such a file must carry the same marker comment (a human confirms the grants/RLS it produces).
// `EXECUTE FUNCTION|PROCEDURE` in CREATE TRIGGER and the privilege `GRANT|REVOKE EXECUTE ON ...` are
// not dynamic SQL and are ignored.
//
// Why: from 2026-10-30 Supabase no longer grants anon/authenticated/service_role on new
// objects in `public`, so a table without a GRANT is invisible to the Data API (42501).
// https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically
//
// Older objects are covered by 20261021090000_explicit_data_api_grants.sql.
// Usage: node scripts/check-migration-grants.mjs [migrationsDir]
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CUTOFF = "20261021090000";
// Only a whole SQL line comment counts: at line start (indentation allowed), exactly this text,
// case-sensitive, not followed by more word characters (so `...-reviewed-not` or text inside a
// statement does not pass).
const DYNAMIC_MARKER = /^[ \t]*-- check-migration-grants: dynamic-reviewed(?![\w-])/m;
const CLIENT_ROLES = new Set(["anon", "authenticated", "public"]);
const here = path.dirname(fileURLToPath(import.meta.url));
const dir = process.argv[2] || path.join(here, "..", "supabase", "migrations");

const stripComments = (sql) => sql.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ");
const IDENT = String.raw`(?:"?([a-z_][a-z0-9_]*)"?\s*\.\s*)?"?([a-z_][a-z0-9_]*)"?`;
const CREATE_RE = new RegExp(
  String.raw`\bcreate\s+(?:or\s+replace\s+)?(?:(?:temp|temporary|unlogged)\s+)?(table|view|materialized\s+view)\s+(?:if\s+not\s+exists\s+)?${IDENT}(?![a-z0-9_]|\s*[.%])`,
  "gi"
);
const GRANT_RE = /\bgrant\s+([\s\S]+?)\s+on\s+([\s\S]+?)\s+to\s+([\s\S]+?)(?:;|\bwith\s+grant\s+option|'|\$|$)/gi;
const RLS_RE = new RegExp(
  String.raw`\balter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?${IDENT}\s+(enable|disable)\s+row\s+level\s+security`,
  "gi"
);
// EXECUTE whose SQL text is not a plain literal: a variable, format(<variable>, ...), or '...' || x.
const OPAQUE_EXECUTE_RE =
  /\bexecute\s+(?:(?!function\b|procedure\b|on\b)[a-z_][a-z0-9_.]*(?![a-z0-9_.]|\s*\()|format\s*\(\s*(?!e?'|\$[a-z_]*\$)|e?'(?:[^']|'')*'\s*\|\||\$([a-z_]*)\$[\s\S]*?\$\1\$\s*\|\|)/i;
const DYNAMIC_RE = /\bexecute\b[\s\S]{0,40}?(?:format\s*\(\s*)?(?:'|\$[a-z_]*\$)\s*create\s+(?:unlogged\s+)?table/i;

const norm = (s) =>
  s
    .trim()
    .toLowerCase()
    .replace(/"/g, "")
    .replace(/^public\s*\.\s*/, "");

// State of the security_invoker option inside a WITH/SET/RESET option list: true, false, or null
// when the option is not mentioned. The last mention wins. `reset` removes it (= false).
function optionState(options, isReset) {
  let state = null;
  for (const part of options.split(",")) {
    const m = part.trim().match(/^security_invoker\s*(?:=\s*(.*))?$/i);
    if (!m) continue;
    if (isReset) state = false;
    else if (m[1] === undefined) state = true;
    else state = /^(true|on|1|'true'|'on'|yes|'yes')$/i.test(m[1].trim());
  }
  return state;
}

function parseGrants(text) {
  const grants = [];
  for (const m of text.matchAll(GRANT_RE)) {
    const objects = m[2].trim();
    const roles = m[3].split(",").map((r) => r.trim().toLowerCase().replace(/"/g, ""));
    if (/^all\s+tables\s+in\s+schema\b/i.test(objects)) {
      if (/\bpublic\b/i.test(objects)) grants.push({ all: true, at: m.index, roles });
      continue;
    }
    if (
      /^(function|functions|procedure|routine|all\s+functions|sequence|all\s+sequences|schema|type|domain)\b/i.test(
        objects
      )
    )
      continue;
    const names = objects
      .replace(/^table\s+/i, "")
      .split(",")
      .map(norm);
    grants.push({ all: false, at: m.index, roles, names });
  }
  return grants;
}

export function checkMigration(sql) {
  const text = stripComments(sql);
  const problems = [];
  if (DYNAMIC_RE.test(text) && !DYNAMIC_MARKER.test(sql)) {
    problems.push(
      "creates a table with dynamic SQL (EXECUTE); review its grants and add the marker comment '-- check-migration-grants: dynamic-reviewed'"
    );
  } else if (OPAQUE_EXECUTE_RE.test(text) && !DYNAMIC_MARKER.test(sql)) {
    problems.push(
      "uses EXECUTE with a variable or computed SQL string that cannot be analysed; review the objects/grants/RLS it produces and add the marker comment '-- check-migration-grants: dynamic-reviewed'"
    );
  }
  const grants = parseGrants(text);
  const rls = new Set();
  // Last ENABLE/DISABLE wins (matchAll yields statements in file order).
  for (const m of text.matchAll(RLS_RE)) {
    if (m[1] && m[1].toLowerCase() !== "public") continue;
    if (m[3].toLowerCase() === "enable") rls.add(m[2].toLowerCase());
    else rls.delete(m[2].toLowerCase());
  }
  for (const m of text.matchAll(CREATE_RE)) {
    const kind = m[1].toLowerCase().replace(/\s+/g, " ");
    if (/\b(temp|temporary)\b/i.test(m[0])) continue;
    if (m[2] && m[2].toLowerCase() !== "public") continue;
    const name = m[3].toLowerCase();
    const relevant = grants.filter((g) => (g.all ? kind === "table" && g.at > m.index : g.names.includes(name)));
    const roles = new Set(relevant.flatMap((g) => g.roles));
    const label = `${kind} public.${name}`;
    if (!roles.has("service_role")) problems.push(`${label}: no GRANT ... TO service_role in this migration`);
    const clientRoles = [...roles].filter((r) => CLIENT_ROLES.has(r));
    if (clientRoles.length && kind === "table" && !rls.has(name)) {
      problems.push(`${label}: granted to ${clientRoles.join(", ")} but RLS is not enabled in this migration`);
    }
    if (clientRoles.length && kind !== "table") {
      const statement = text.slice(m.index).split(";")[0];
      // security_invoker state: the CREATE's own WITH (...) first, then every later
      // ALTER VIEW <name> SET|RESET (...) in file order; the last one wins.
      const alterRe = new RegExp(
        String.raw`\balter\s+(?:materialized\s+)?view\s+(?:if\s+exists\s+)?(?:"?public"?\s*\.\s*)?"?${name}"?\s+(set|reset)\s*\(([^)]*)\)`,
        "gi"
      );
      let invoker = optionState(statement.match(/\bwith\s*\(([^)]*)\)/i)?.[1] ?? "", false);
      for (const a of text.matchAll(alterRe)) {
        if (a.index < m.index) continue;
        const state = optionState(a[2], a[1].toLowerCase() === "reset");
        if (state !== null) invoker = state;
      }
      if (invoker !== true)
        problems.push(
          `${label}: granted to ${clientRoles.join(", ")} without security_invoker (definer views bypass RLS)`
        );
    }
  }
  return problems;
}

function main() {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const problems = [];
  for (const file of files) {
    const version = file.split("_")[0];
    if (version.padEnd(14, "0") < CUTOFF) continue;
    for (const p of checkMigration(readFileSync(path.join(dir, file), "utf8"))) problems.push(`${file}: ${p}`);
  }
  if (problems.length) {
    console.error("Supabase Data API grant check failed (2026-10-30 explicit grants):");
    for (const p of problems) console.error(`  - ${p}`);
    console.error("Example: alter table public.<t> enable row level security;");
    console.error("         grant select, insert, update, delete on table public.<t> to authenticated, service_role;");
    console.error("(anon only when an RLS policy is meant for it.)");
    process.exit(1);
  }
  console.log(`check-migration-grants: OK (${files.length} migrations scanned, cutoff ${CUTOFF})`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
