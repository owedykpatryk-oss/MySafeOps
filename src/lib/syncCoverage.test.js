import { describe, expect, it } from "vitest";
import { D1_LIVE_SYNC_NAMESPACES, LOCAL_ONLY_STORAGE_KEYS, validateD1BackupCoverage } from "./syncCoverage.js";
import { D1_BACKUP_PUSH_NAMESPACES } from "./d1ImportNamespaces.js";

describe("syncCoverage", () => {
  it("every live D1 namespace is included in backup push allowlist", () => {
    const { ok, missingFromBackup } = validateD1BackupCoverage();
    expect(ok, `missing: ${missingFromBackup.join(", ")}`).toBe(true);
  });

  it("backup allowlist has no unexpected duplicates vs live list", () => {
    for (const ns of D1_LIVE_SYNC_NAMESPACES) {
      expect(D1_BACKUP_PUSH_NAMESPACES.has(ns)).toBe(true);
    }
  });

  it("documents known local-only keys and newly synced registers", () => {
    expect(LOCAL_ONLY_STORAGE_KEYS).toContain("emergency_contacts");
    expect(LOCAL_ONLY_STORAGE_KEYS).not.toContain("cdm_packs");
    expect(D1_LIVE_SYNC_NAMESPACES).toContain("geo_photos");
    expect(D1_LIVE_SYNC_NAMESPACES).toContain("survey_reports");
    expect(D1_LIVE_SYNC_NAMESPACES).toContain("fire_safety_log");
    expect(D1_LIVE_SYNC_NAMESPACES).toContain("cdm_packs");
    expect(D1_LIVE_SYNC_NAMESPACES).toContain("mysafeops_timesheets");
  });
});
