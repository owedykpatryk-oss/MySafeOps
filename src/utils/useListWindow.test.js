import { describe, it, expect } from "vitest";
import { computeListWindow } from "./useListWindow.js";

describe("computeListWindow", () => {
  it("disables windowing for short lists", () => {
    const w = computeListWindow(10, 0, { rowHeight: 40, maxHeight: 200 });
    expect(w.enabled).toBe(false);
    expect(w.start).toBe(0);
    expect(w.end).toBe(10);
    expect(w.totalHeight).toBe(400);
  });

  it("windows long lists with overscan", () => {
    const w = computeListWindow(100, 0, { rowHeight: 40, maxHeight: 200, overscan: 2 });
    expect(w.enabled).toBe(true);
    expect(w.totalHeight).toBe(4000);
    expect(w.start).toBe(0);
    // ceil(200/40)=5 + overscan*2=4 → 9
    expect(w.end).toBe(9);
  });

  it("advances start with scrollTop", () => {
    const w = computeListWindow(100, 400, { rowHeight: 40, maxHeight: 200, overscan: 2 });
    expect(w.start).toBe(8); // floor(400/40)-2
    expect(w.offsetY).toBe(320);
    expect(w.end).toBe(17);
  });
});
