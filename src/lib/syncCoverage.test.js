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

  it("documents known local-only keys", () => {
    expect(LOCAL_ONLY_STORAGE_KEYS).toContain("cdm_packs");
    expect(LOCAL_ONLY_STORAGE_KEYS).toContain("fire_safety_log");
    expect(D1_LIVE_SYNC_NAMESPACES).toContain("geo_photos");
    expect(D1_LIVE_SYNC_NAMESPACES).toContain("survey_reports");
  });
});
