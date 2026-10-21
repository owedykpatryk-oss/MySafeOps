import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
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

function fixture(sql) {
  const dir = mkdtempSync(path.join(tmpdir(), "grants-"));
  writeFileSync(path.join(dir, "20991231000000_new_table.sql"), sql);
  return dir;
}

describe("check-migration-grants (Supabase 2026-10-30 explicit grants)", () => {
  it("passes for the migrations in this repo", () => {
    expect(run()).toBe(0);
  });

  it("fails when a new public table has no GRANT", () => {
    const dir = fixture("create table if not exists public.demo (id uuid primary key);\nalter table public.demo enable row level security;\n");
    try {
      expect(run(dir)).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("passes when the new table is granted in the same migration", () => {
    const dir = fixture("create table public.demo (id uuid primary key);\nalter table public.demo enable row level security;\ngrant select, insert, update, delete on table public.demo to authenticated, service_role;\n");
    try {
      expect(run(dir)).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
