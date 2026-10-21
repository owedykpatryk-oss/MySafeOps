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
  it("fails when only authenticated is granted (service_role missing)", () => {
    const dir = fixture("create table public.demo (id uuid primary key);\nalter table public.demo enable row level security;\ngrant select on table public.demo to authenticated;\n");
    try {
      expect(run(dir)).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fails when a client role is granted without RLS", () => {
    const dir = fixture("create table public.demo (id uuid primary key);\ngrant select on table public.demo to authenticated, service_role;\n");
    try {
      expect(run(dir)).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fails for CREATE OR REPLACE VIEW without grants", () => {
    const dir = fixture("create or replace view public.demo_v as select 1 as x;\n");
    try {
      expect(run(dir)).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fails for a definer view granted to authenticated", () => {
    const dir = fixture("create view public.demo_v as select 1 as x;\ngrant select on public.demo_v to authenticated, service_role;\n");
    try {
      expect(run(dir)).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("does not let an earlier GRANT ON ALL TABLES cover a later table", () => {
    const dir = fixture("grant select on all tables in schema public to service_role;\ncreate table public.demo (id uuid primary key);\n");
    try {
      expect(run(dir)).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fails for dynamic table creation without the review marker", () => {
    const dir = fixture("do $$ begin execute format('create table public.%I (id int)', 'demo'); end $$;\n");
    try {
      expect(run(dir)).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
