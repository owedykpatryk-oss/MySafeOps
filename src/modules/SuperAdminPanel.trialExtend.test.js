import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SUPERADMIN_EXTEND_TRIAL_DAYS } from "../utils/superAdmin.js";

const PANEL_PATH = join(process.cwd(), "src", "modules", "SuperAdminPanel.jsx");

describe("Superadmin Trial +14d", () => {
  const src = readFileSync(PANEL_PATH, "utf8");

  it("lists the courtesy trial migration and confirms overwrite from now", () => {
    expect(SUPERADMIN_EXTEND_TRIAL_DAYS).toBe(14);
    expect(src).toContain("20260817130000_utility_mapping_trial_extension.sql");
    expect(src).toContain("superadminExtendOrgTrial");
    expect(src).toContain("from now?");
    expect(src).toContain("`Trial +${SUPERADMIN_EXTEND_TRIAL_DAYS}d`");
    expect(src).toContain("setRecentOrgs((prev) => ({");
  });
});
