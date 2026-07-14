import { describe, expect, it } from "vitest";
import { computeProjectDrawingReadiness } from "./projectDrawingReadiness.js";

describe("computeProjectDrawingReadiness", () => {
  it("scores zero when nothing is set up", () => {
    const r = computeProjectDrawingReadiness({});
    expect(r.score).toBe(0);
    expect(r.tone).toBe("low");
    expect(r.missing.length).toBeGreaterThan(0);
  });

  it("scores full when all checks pass", () => {
    const r = computeProjectDrawingReadiness({
      siteOk: true,
      hasBoundary: true,
      objects: [
        { type: "master_point" },
        { type: "first_aid" },
      ],
      escapeRouteCount: 1,
      hospitalReady: true,
      screenshotSaved: true,
    });
    expect(r.score).toBe(100);
    expect(r.tone).toBe("ready");
    expect(r.label).toBe("RAMS ready");
    expect(r.missing).toHaveLength(0);
  });

  it("marks partial progress when site and boundary only", () => {
    const r = computeProjectDrawingReadiness({
      siteOk: true,
      hasBoundary: true,
      objects: [{ type: "master_point" }],
      escapeRouteCount: 0,
      hospitalReady: false,
      screenshotSaved: false,
    });
    expect(r.score).toBe(45);
    expect(r.tone).toBe("low");
  });

  it("counts screenshotSaved toward map attachment check", () => {
    const r = computeProjectDrawingReadiness({
      screenshotSaved: true,
      objects: [],
      escapeRouteCount: 0,
      hospitalReady: false,
    });
    expect(r.items.find((c) => c.id === "screenshot")?.done).toBe(true);
  });
});
