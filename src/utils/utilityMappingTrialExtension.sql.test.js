import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { UTILITY_MAPPING_ORG_SLUGS } from "./utilityMappingWorkspaceProfile.js";

const SQL_PATH = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260817130000_utility_mapping_trial_extension.sql"
);

function hyphenSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
}

describe("Utility Mapping trial extension SQL", () => {
  const sql = readFileSync(SQL_PATH, "utf8");

  it("extends the live auto-provisioned u-map tenant and canonical slugs", () => {
    expect(sql).toContain("patryk-44bdf196");
    expect(sql).toContain("utility-mapping");
    expect(sql).toContain("now() + interval '14 days'");
    expect(sql).toMatch(/returning o\.slug, o\.trial_ends_at/i);
  });

  it("keeps the courtesy IN list exactly the hyphen-normalised client allowlist", () => {
    const inList = sql.slice(sql.lastIndexOf("update public.organizations"));
    const inStart = inList.search(/\bin\s*\(/i);
    const inEnd = inList.indexOf(")", inStart);
    const sqlSlugs = [...inList.slice(inStart, inEnd).matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
    const jsSlugs = [...new Set([...UTILITY_MAPPING_ORG_SLUGS].map(hyphenSlug))].sort();
    expect(jsSlugs).toContain("patryk-44bdf196");
    expect(sqlSlugs).toEqual(jsSlugs);
  });

  it("Superadmin RPC overwrites trial_ends_at from now, unlike the courtesy UPDATE guard", () => {
    const fn = sql.slice(
      sql.indexOf("create or replace function public.superadmin_extend_org_trial"),
      sql.indexOf("revoke all on function public.superadmin_extend_org_trial")
    );
    expect(fn).toContain("trial_ends_at = now() + (v_days * interval '1 day')");
    expect(fn).not.toMatch(/greatest\s*\(\s*(?:o\.)?trial_ends_at/i);
    expect(fn).not.toMatch(/trial_ends_at\s*<\s*now\(\)/i);
  });

  it("matches @u-map.co.uk by domain equality, not a suffix LIKE", () => {
    expect(sql).toContain("split_part(lower(u.email), '@', 2) = 'u-map.co.uk'");
    const withoutComments = sql.replace(/--[^\n]*/g, "");
    expect(withoutComments).not.toMatch(/like\s+'%@u-map\.co\.uk'/i);
  });

  it("gates the Superadmin RPC on user_is_platform_owner and clamps days", () => {
    expect(sql).toContain("user_is_platform_owner()");
    expect(sql).toContain("least(greatest(coalesce(p_days, 14), 1), 90)");
    expect(sql).toContain("grant execute on function public.superadmin_extend_org_trial(text, int) to authenticated");
  });

  it("does not shorten a trial already beyond now + 14 days", () => {
    const withoutComments = sql.replace(/--[^\n]*/g, "");
    expect(withoutComments).toMatch(
      /and\s*\(\s*o\.trial_ends_at is null or o\.trial_ends_at < now\(\) \+ interval '14 days'\s*\)/i
    );
    const updateBlock = withoutComments.slice(withoutComments.lastIndexOf("update public.organizations"));
    expect(updateBlock).toMatch(/\(\s*lower\(replace\(o\.slug/);
  });
});
