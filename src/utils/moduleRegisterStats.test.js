/** @vitest-environment jsdom */
import { describe, expect, it, beforeEach } from "vitest";
import { itemNeedsAttention, summarizeSectionStats, getModuleRegisterStat } from "./moduleRegisterStats.js";
import { saveOrgScoped as save } from "./orgStorage";

describe("moduleRegisterStats", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("mysafeops_orgId", "test-org");
  });

  it("flags overdue due dates", () => {
    expect(itemNeedsAttention({ dueDate: "2020-01-01" })).toBe(true);
    expect(itemNeedsAttention({ status: "open" })).toBe(true);
    expect(itemNeedsAttention({ status: "closed", dueDate: "2099-01-01" })).toBe(false);
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
