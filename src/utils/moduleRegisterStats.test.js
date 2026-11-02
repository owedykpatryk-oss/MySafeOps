/** @vitest-environment jsdom */
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { buildRegisterModuleStats } from "./registerModuleStatsBuilder";
import { highCareToolsMatch, daysUntilRegisterDue, cipPassedSwabCount } from "./registerRecordStatus";
import { itemNeedsAttention, summarizeSectionStats, getModuleRegisterStat } from "./moduleRegisterStats.js";
import { saveOrgScoped as save } from "./orgStorage";

describe("moduleRegisterStats", () => {
  afterEach(() => vi.useRealTimers());
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("mysafeops_orgId", "test-org");
  });

  it("flags overdue due dates", () => {
    expect(itemNeedsAttention({ dueDate: "2020-01-01" })).toBe(true);
    expect(itemNeedsAttention({ status: "open" })).toBe(true);
    expect(itemNeedsAttention({ status: "closed", dueDate: "2099-01-01" })).toBe(false);
  });

  it("does not flag historical inspection, assessment or sign-off dates", () => {
    expect(itemNeedsAttention({ result: "pass", testDate: "2020-01-01", inspectedAt: "2020-01-01", signedOffAt: "2020-01-01" })).toBe(false);
    expect(itemNeedsAttention({ reviewDate: "2020-01-01", assessedDate: "2020-01-01", nextReviewDate: "2099-01-01" }, "dsear")).toBe(false);
    expect(itemNeedsAttention({ result: "fail" })).toBe(true);
    expect(itemNeedsAttention({ nextReviewDate: "2020-01-01" }, "dsear")).toBe(true);
  });

  it("uses calendar days and agrees with the incident action overdue count", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 5, 15));
    expect(daysUntilRegisterDue("2026-10-12")).toBe(7);
    expect(itemNeedsAttention({ status: "open", dueDate: "2026-10-05" }, "incident-actions")).toBe(false);
    expect(itemNeedsAttention({ status: "closed", dueDate: "2020-01-01" }, "incident-actions")).toBe(false);
    const rows = [{ status: "open", dueDate: "2026-10-04" }, { status: "open", dueDate: "2026-10-12" }];
    expect(buildRegisterModuleStats("incident-actions", rows).find((s) => s.label === "Overdue").value).toBe(1);
  });

  it("counts positives using the form polarity field and excludes deleted records", () => {
    expect(buildRegisterModuleStats("observations", [{ polarity: "positive" }, { polarity: "positive", deletedAt: "2026-10-05" }]).find((s) => s.label === "Positive").value).toBe(1);
    save("electrical_pat_log", [{ id: "passed", result: "pass", testDate: "2020-01-01" }, { id: "removed", deletedAt: "2026-10-05" }]);
    expect(getModuleRegisterStat("electrical-pat")).toMatchObject({ count: 1, attentionCount: 0 });
  });

  it("tracks GMP closure, CIP failures and glass breakage", () => {
    expect(itemNeedsAttention({ status: "open", closedAt: Date.now() }, "gmp-deviations")).toBe(false);
    expect(buildRegisterModuleStats("gmp-deviations", [{ closedAt: Date.now() }]).find((s) => s.label === "Open").value).toBe(0);
    expect(itemNeedsAttention({ breakageReported: true }, "ghp-register")).toBe(true);
    const cip = { swabResults: [{ pass: false, atpRlu: 420 }, { pass: "false", atpRlu: 650 }], visualInspectionPassed: true, signedOffBy: "QA", releasedToProductionAt: Date.now() };
    expect(cipPassedSwabCount(cip)).toBe(0);
    expect(itemNeedsAttention(cip, "cip-signoff")).toBe(true);
    expect(itemNeedsAttention({ ...cip, swabResults: [{ pass: true }] }, "cip-signoff")).toBe(false);
  });

  it("reconciles tool quantities independently of order and flags missing tools on exit", () => {
    expect(highCareToolsMatch({ toolsIn: "driver, spanner", toolsOut: "spanner, driver" })).toBe(true);
    expect(highCareToolsMatch({ toolsIn: "driver, driver", toolsOut: "driver" })).toBe(false);
    const row = { hygieneChecks: { handWash: true }, exitTimestamp: Date.now(), toolsIn: "driver", toolsOut: "" };
    expect(itemNeedsAttention(row, "high-care-access")).toBe(true);
  });

  it("summarizes section health", () => {
    const map = {
      a: { count: 0, status: "empty", attentionCount: 0 },
      b: { count: 5, status: "active", attentionCount: 0 },
      c: { count: 2, status: "attention", attentionCount: 1 },
    };
    const s = summarizeSectionStats(map, ["a", "b", "c"]);
    expect(s.empty).toBe(1);
    expect(s.active).toBe(1);
    expect(s.attention).toBe(1);
    expect(s.records).toBe(7);
  });

  it("includes 7-day sparkline buckets for active registers", () => {
    const today = new Date().toISOString();
    save("snags", [
      { id: "1", status: "open", createdAt: today },
      { id: "2", status: "open", createdAt: today },
    ]);
    const stat = getModuleRegisterStat("snags");
    expect(stat.sparkline).not.toBeNull();
    expect(stat.sparkline.buckets).toHaveLength(7);
    expect(stat.sparkline.bucketDates).toHaveLength(7);
    expect(stat.sparkline.total).toBeGreaterThanOrEqual(2);
  });
});
