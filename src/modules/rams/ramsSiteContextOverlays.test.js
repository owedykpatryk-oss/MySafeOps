/** @vitest-environment node */
import { describe, it, expect } from "vitest";
import {
  SITE_CONTEXT_OVERLAYS,
  getSiteContextOverlay,
  mergeSiteContextHazardTokens,
  appendSiteContextScope,
  findHazardsForSiteContext,
  formatSiteContextBriefing,
  mergeUniqueStrings,
} from "./ramsSiteContextOverlays";
import SITE_CONTEXT_LIBRARY from "./ramsHazardLibrarySiteContext";

describe("ramsSiteContextOverlays", () => {
  it("defines five primary site overlays", () => {
    expect(SITE_CONTEXT_OVERLAYS.map((o) => o.key)).toEqual([
      "treatment_works",
      "substation_hv",
      "rail_nr",
      "highway_tm",
      "brownfield",
    ]);
  });

  it("resolves overlay by key", () => {
    expect(getSiteContextOverlay("substation_hv")?.shortLabel).toBe("Substation / HV");
    expect(getSiteContextOverlay("missing")).toBeNull();
  });

  it("merges hazard tokens without duplicates", () => {
    const overlay = getSiteContextOverlay("rail_nr");
    const merged = mergeSiteContextHazardTokens(["utility", "rail"], overlay);
    expect(merged.filter((t) => t.toLowerCase() === "rail").length).toBe(1);
    expect(merged).toContain("pts");
  });

  it("appends scope addendum once", () => {
    const overlay = getSiteContextOverlay("highway_tm");
    const once = appendSiteContextScope("Base scope.", overlay);
    const twice = appendSiteContextScope(once, overlay);
    expect(once).toContain("Chapter 8");
    expect(twice).toBe(once);
  });

  it("formats briefing bullets", () => {
    const text = formatSiteContextBriefing(getSiteContextOverlay("treatment_works"));
    expect(text).toContain("Site context briefing");
    expect(text).toContain("Gas monitor");
  });

  it("finds library hazards by overlay ids", () => {
    const overlay = getSiteContextOverlay("brownfield");
    const found = findHazardsForSiteContext(overlay, SITE_CONTEXT_LIBRARY);
    expect(found.map((h) => h.id)).toEqual(expect.arrayContaining(["site_ctx_009", "site_ctx_010"]));
  });

  it("merges unique permit / cert strings", () => {
    expect(mergeUniqueStrings(["A", "b"], ["B", "C"])).toEqual(["A", "b", "C"]);
  });

  it("has hazard rows for every overlay hazardId", () => {
    const ids = new Set(SITE_CONTEXT_LIBRARY.map((h) => h.id));
    for (const o of SITE_CONTEXT_OVERLAYS) {
      for (const id of o.hazardIds) {
        if (id.startsWith("site_ctx_")) expect(ids.has(id)).toBe(true);
      }
    }
  });
});
