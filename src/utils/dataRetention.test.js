/** @vitest-environment jsdom */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { LOCAL_AUDIT_RETENTION_YEARS, purgeExpiredLocalAudit, runLocalRetentionJobs } from "./dataRetention.js";

describe("dataRetention", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("mysafeops_orgId", "test-org");
  });
  afterEach(() => {
    localStorage.clear();
  });

  it("keeps recent local audit rows and drops aged ones", () => {
    const now = Date.now();
    const oldIso = new Date(now - (LOCAL_AUDIT_RETENTION_YEARS + 1) * 365.25 * 24 * 60 * 60 * 1000).toISOString();
    const freshIso = new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString();
    localStorage.setItem(
      "mysafeops_audit_test-org",
      JSON.stringify([
        { id: "1", at: oldIso, action: "old" },
        { id: "2", at: freshIso, action: "new" },
      ]),
    );
    expect(purgeExpiredLocalAudit(now)).toBe(1);
    const kept = JSON.parse(localStorage.getItem("mysafeops_audit_test-org"));
    expect(kept).toHaveLength(1);
    expect(kept[0].id).toBe("2");
  });

  it("runLocalRetentionJobs returns counts", () => {
    const r = runLocalRetentionJobs();
    expect(r).toEqual({ auditRemoved: 0, recycleRemoved: 0 });
  });
});
