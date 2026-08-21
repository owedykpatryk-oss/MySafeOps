import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SQL_PATH = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260817130000_utility_mapping_trial_extension.sql"
);

describe("Utility Mapping trial extension SQL", () => {
  const sql = readFileSync(SQL_PATH, "utf8");

  it("extends the live auto-provisioned u-map tenant and canonical slugs", () => {
    expect(sql).toContain("patryk-44bdf196");
    expect(sql).toContain("utility-mapping");
    expect(sql).toContain("now() + interval '14 days'");
    expect(sql).toMatch(/returning o\.slug, o\.trial_ends_at/i);
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
