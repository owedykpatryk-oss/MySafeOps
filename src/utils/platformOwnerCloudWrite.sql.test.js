import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SQL_PATH = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20261005081149_platform_owner_cloud_write.sql"
);

function extractFunction(sql, name) {
  const re = new RegExp(`create or replace function public\\.${name}[\\s\\S]*?\\$\\$;`, "i");
  const match = sql.match(re);
  if (!match) throw new Error(`missing function ${name}`);
  return match[0];
}

describe("platform owner cloud write SQL", () => {
  const sql = readFileSync(SQL_PATH, "utf8");

  it("lets a platform-owner member through user_can_write_org_slug before the billing function", () => {
    const fn = extractFunction(sql, "user_can_write_org_slug");
    const membership = fn.indexOf("user_can_access_org_slug");
    const owner = fn.indexOf("user_is_platform_owner()");
    const billing = fn.indexOf("org_allows_cloud_writes");
    expect(membership).toBeGreaterThan(-1);
    expect(owner).toBeGreaterThan(membership);
    expect(billing).toBeGreaterThan(owner);
    expect(sql).toContain("grant execute on function public.user_can_write_org_slug(text) to authenticated");
  });

  it("keeps the org billing paywall and still short-circuits platform owners", () => {
    const fn = extractFunction(sql, "org_allows_cloud_writes");
    expect(fn.indexOf("user_is_platform_owner()")).toBeGreaterThan(-1);
    expect(fn.indexOf("user_is_platform_owner()")).toBeLessThan(fn.indexOf("trial_ends_at"));
    expect(fn).toContain("v_status in ('unpaid', 'canceled')");
    expect(fn).toContain("return v_trial_ends > now()");
    expect(fn).toContain("'starter', 'team', 'business', 'enterprise', 'enterprise_plus'");
  });

  it("skips billing on KV write and delete without dropping role checks", () => {
    const write = extractFunction(sql, "user_can_write_org_kv");
    const del = extractFunction(sql, "user_can_delete_org_kv");
    expect(write).toContain("not public.user_is_platform_owner()");
    expect(write).toContain("org_allows_cloud_writes");
    expect(write).toContain("'mysafeops_workers'");
    expect(write).toContain("v_role is null");
    expect(del).toContain("not public.user_is_platform_owner()");
    expect(del).toContain("m.role in ('admin', 'supervisor')");
  });

  it("exempts platform owners from the country subscription check only", () => {
    const fn = extractFunction(sql, "user_can_write_org_country_kv");
    const roleGate = fn.indexOf("if v_role is null then return false; end if;");
    const ownerGate = fn.indexOf("if not public.user_is_platform_owner() then");
    const paid = fn.indexOf("v_status in ('active', 'trialing')");
    expect(fn).toContain("return public.user_can_write_org_kv(p_org_slug, p_namespace);");
    expect(roleGate).toBeGreaterThan(-1);
    expect(ownerGate).toBeGreaterThan(roleGate);
    expect(paid).toBeGreaterThan(ownerGate);
    expect(fn).toContain("org_country_workspace_memberships");
    expect(fn).toContain("if v_role in ('admin', 'supervisor') then return true; end if;");
  });
});
