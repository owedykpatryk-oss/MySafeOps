import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const script = path.join(process.cwd(), "scripts", "check-migration-grants.mjs");

function run(dir) {
  try {
    execFileSync(process.execPath, dir ? [script, dir] : [script], { stdio: "pipe" });
    return 0;
  } catch (error) {
    return error.status ?? 1;
  }
}

function withFixture(sql) {
  const dir = mkdtempSync(path.join(tmpdir(), "grants-"));
  writeFileSync(path.join(dir, "20991231000000_new_table.sql"), sql);
  try {
    return run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("check-migration-grants (Supabase 2026-10-30 explicit grants)", () => {
  it("passes for the migrations in this repo", () => {
    expect(run()).toBe(0);
  });

  it("only scans supabase/migrations", () => {
    expect(readFileSync(script, "utf8").includes('path.join(here, "..", "supabase", "migrations")')).toBe(true);
  });

  it("ignores a migration older than the cutoff", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "grants-"));
    writeFileSync(path.join(dir, "20200101000000_old.sql"), "create table public.old_t (id int);\n");
    try {
      expect(run(dir)).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  const BASIC = [
    ["fails when a new public table has no GRANT", "create table if not exists public.demo (id uuid primary key);\nalter table public.demo enable row level security;\n", 1],
    ["passes when the new table is granted in the same migration", "create table public.demo (id uuid primary key);\nalter table public.demo enable row level security;\ngrant select, insert, update, delete on table public.demo to authenticated, service_role;\n", 0],
    ["fails when only authenticated is granted (service_role missing)", "create table public.demo (id uuid primary key);\nalter table public.demo enable row level security;\ngrant select on table public.demo to authenticated;\n", 1],
    ["fails when a client role is granted without RLS", "create table public.demo (id uuid primary key);\ngrant select on table public.demo to authenticated, service_role;\n", 1],
    ["fails for CREATE OR REPLACE VIEW without grants", "create or replace view public.demo_v as select 1 as x;\n", 1],
    ["fails for a definer view granted to authenticated", "create view public.demo_v as select 1 as x;\ngrant select on public.demo_v to authenticated, service_role;\n", 1],
    ["does not let an earlier GRANT ON ALL TABLES cover a later table", "grant select on all tables in schema public to service_role;\ncreate table public.demo (id uuid primary key);\n", 1],
    ["fails for dynamic table creation without the review marker", "do $$ begin execute format('create table public.%I (id int)', 'demo'); end $$;\n", 1],
  ];
  for (const [name, sql, expected] of BASIC) {
    it(name, () => {
      expect(withFixture(sql)).toBe(expected);
    });
  }
});

const BASE_TABLE =
  "create table public.t (id int);\ngrant select on table public.t to authenticated, service_role;\n";
const view = (name, opts) =>
  `create view public.${name} ${opts} as select 1 as x;\ngrant select on public.${name} to authenticated, service_role;\n`;
const CASES = [
  [
    "fails when a later DISABLE ROW LEVEL SECURITY undoes the ENABLE",
    BASE_TABLE +
      "alter table public.t enable row level security;\nalter table public.t disable row level security;\n",
    1,
  ],
  [
    "passes when RLS is disabled and then enabled again",
    BASE_TABLE +
      "alter table public.t disable row level security;\nalter table public.t enable row level security;\n",
    0,
  ],
  [
    "fails when only one of two views in a file has security_invoker",
    view("a", "with (security_invoker = true)") + view("b", ""),
    1,
  ],
  [
    "fails when the second view sets security_invoker = false",
    view("a", "with (security_invoker = true)") +
      view("b", "with (security_invoker = false)"),
    1,
  ],
  [
    "passes when both views in a file have security_invoker",
    view("a", "with (security_invoker = true)") +
      view("b", "with (security_invoker)"),
    0,
  ],
  [
    "passes when a view gets security_invoker through ALTER VIEW",
    view("a", "") + "alter view public.a set (security_invoker = true);\n",
    0,
  ],
  [
    "fails for EXECUTE with a variable (cannot be analysed)",
    "do $$ begin execute v_sql; end $$;\n",
    1,
  ],
  [
    "fails for EXECUTE format() with a variable format string",
    "do $$ begin execute format(v_fmt, 'x'); end $$;\n",
    1,
  ],
  [
    "passes for EXECUTE with a variable when marked dynamic-reviewed",
    "-- check-migration-grants: dynamic-reviewed\ndo $$ begin execute v_sql; end $$;\n",
    0,
  ],
  [
    "passes for EXECUTE FUNCTION in CREATE TRIGGER",
    "create trigger t before insert on public.x for each row execute function public.f();\n",
    0,
  ],
  [
    "passes for GRANT EXECUTE ON FUNCTION (a privilege, not dynamic SQL)",
    "grant execute on function public.get_org_invite_preview(text) to anon, authenticated, service_role;\n",
    0,
  ],
  [
    "passes for REVOKE EXECUTE ON FUNCTION",
    "revoke execute on function public.get_org_invite_preview(text) from public;\nREVOKE EXECUTE ON FUNCTION public.f() FROM anon;\n",
    0,
  ],
  [
    "passes for GRANT EXECUTE ON ALL FUNCTIONS split over lines",
    "grant execute\n  on all functions in schema public to service_role;\n",
    0,
  ],
  [
    "fails for EXECUTE of a variable that merely starts with 'on'",
    "do $$ begin execute on_x; end $$;\n",
    1,
  ],
  [
    "marker is case-sensitive",
    "-- CHECK-MIGRATION-GRANTS: DYNAMIC-REVIEWED\ndo $$ begin execute v_sql; end $$;\n",
    1,
  ],
  [
    "marker must not be followed by more word characters",
    "-- check-migration-grants: dynamic-reviewed-not\ndo $$ begin execute v_sql; end $$;\n",
    1,
  ],
  [
    "marker must be at the start of a line, not after a statement",
    "select 1; -- check-migration-grants: dynamic-reviewed\ndo $$ begin execute v_sql; end $$;\n",
    1,
  ],
  [
    "marker inside a string literal does not count",
    "select 'check-migration-grants: dynamic-reviewed';\ndo $$ begin execute v_sql; end $$;\n",
    1,
  ],
  [
    "fails when ALTER VIEW later sets security_invoker = false",
    view("a", "with (security_invoker = true)") +
      "alter view public.a set (security_invoker = false);\n",
    1,
  ],
  [
    "fails when ALTER VIEW later RESETs security_invoker",
    view("a", "with (security_invoker = true)") +
      "alter view public.a reset (security_invoker);\n",
    1,
  ],
  [
    "passes when ALTER VIEW later sets security_invoker = true again",
    view("a", "with (security_invoker = false)") +
      "alter view public.a set (security_invoker = true);\n",
    0,
  ],
];


describe("check-migration-grants: view, RLS and EXECUTE edge cases", () => {
  for (const [name, sql, expected] of CASES) {
    it(name, () => {
      expect(withFixture(sql)).toBe(expected);
    });
  }
});
