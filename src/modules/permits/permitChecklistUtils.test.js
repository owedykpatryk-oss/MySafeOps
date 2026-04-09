import { describe, it, expect } from "vitest";
import { createDefaultChecklistItems, normalizeChecklistItems, normalizeChecklistState } from "./permitChecklistUtils";

describe("permitChecklistUtils", () => {
  it("normalizeChecklistState merges id and legacy index keys", () => {
    const items = [
      { id: "a", text: "First" },
      { id: "b", text: "Second" },
    ];
    expect(normalizeChecklistState({ a: true, 1: true }, items)).toEqual({ a: true, b: true });
  });

  it("normalizeChecklistItems falls back to default strings", () => {
    const items = normalizeChecklistItems("hot_work", {}, ["One", "Two"]);
    expect(items.map((i) => i.id)).toEqual(["hot_work_1", "hot_work_2"]);
    expect(items[0].text).toBe("One");
  });

  it("createDefaultChecklistItems builds stable ids", () => {
    const items = createDefaultChecklistItems("general", ["A"]);
    expect(items[0].id).toBe("general_1");
  });
});
