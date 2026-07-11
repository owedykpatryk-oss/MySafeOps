/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from "vitest";
import { setOrgId } from "./orgStorage";
import { saveOrgSettingsRaw } from "./orgSettingsStorage";
import {
  buildFessRamsTemplateCatalog,
  getFessTemplateLibraryStats,
  searchFessRamsTemplates,
} from "./fessRamsTemplateLibrary";

describe("fessRamsTemplateLibrary", () => {
  beforeEach(() => {
    localStorage.clear();
    setOrgId("fess-group");
    saveOrgSettingsRaw({ name: "FESS Group" });
  });

  it("builds catalog with starters and reference PDFs", () => {
    const catalog = buildFessRamsTemplateCatalog();
    expect(catalog.some((e) => e.type === "starter")).toBe(true);
    expect(catalog.some((e) => e.type === "reference_pdf")).toBe(true);
    expect(catalog.length).toBeGreaterThan(30);
  });

  it("searches by client and query", () => {
    const quorn = searchFessRamsTemplates("quorn", { type: "starter" });
    expect(quorn.length).toBeGreaterThan(0);
    expect(quorn[0].client).toMatch(/Quorn/i);

    const dolav = searchFessRamsTemplates("dolav", { type: "starter" });
    expect(dolav.some((e) => e.starterKey === "dolav_meyn")).toBe(true);
  });

  it("returns stats for FESS org", () => {
    const stats = getFessTemplateLibraryStats();
    expect(stats.starterCount).toBeGreaterThanOrEqual(19);
    expect(stats.referencePdfCount).toBeGreaterThan(15);
    expect(stats.siteCount).toBe(6);
  });

  it("returns empty catalog for non-FESS org", () => {
    setOrgId("acme");
    expect(buildFessRamsTemplateCatalog()).toEqual([]);
  });
});
