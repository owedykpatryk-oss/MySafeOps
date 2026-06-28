import { describe, expect, it } from "vitest";
import { itemNeedsAttention, summarizeSectionStats } from "./moduleRegisterStats.js";

describe("moduleRegisterStats", () => {
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
});
