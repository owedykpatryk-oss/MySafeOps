import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { hasPermitGuidance, getPermitGuidance, renderGuidancePrintHtml } from "./registry";
import {
  hotWorkAssessment,
  renderFireWatchTimelineSvg,
  renderHotWorkGoNoGoSvg,
  DEFAULT_FIRE_WATCH_MINS,
} from "./hotWorkGuidance";
import { wahAssessment, renderWahHierarchySvg, renderWahPrintHtml } from "./wahGuidance";
import { confinedSpaceAssessment, renderConfinedGaugeSvg, renderConfinedPrintHtml } from "./confinedSpaceGuidance";
import PermitWahGuidancePanel from "./components/PermitWahGuidancePanel";
import PermitConfinedSpaceGuidancePanel from "./components/PermitConfinedSpaceGuidancePanel";

describe("permitGuidance registry", () => {
  it("registers tier-1 permit types with guidance", () => {
    expect(hasPermitGuidance("hot_work")).toBe(true);
    expect(hasPermitGuidance("work_at_height")).toBe(true);
    expect(hasPermitGuidance("confined_space")).toBe(true);
    expect(hasPermitGuidance("excavation")).toBe(true);
    expect(hasPermitGuidance("general")).toBe(false);
  });

  it("returns wizard hints for hot work", () => {
    expect(getPermitGuidance("hot_work")?.wizardHint).toMatch(/fire watch/i);
  });

  it("hides UK PAS 128 excavation guidance on Poland and Australia workspaces", () => {
    expect(hasPermitGuidance("excavation", "uk")).toBe(true);
    expect(getPermitGuidance("excavation", "uk")?.wizardHint).toMatch(/PAS 128/);
    expect(hasPermitGuidance("excavation", "pl")).toBe(false);
    expect(hasPermitGuidance("ground_disturbance", "pl")).toBe(false);
    expect(hasPermitGuidance("excavation", "au")).toBe(false);
    expect(hasPermitGuidance("ground_disturbance", "au")).toBe(false);
    expect(hasPermitGuidance("hot_work", "pl")).toBe(true);
  });

  it("uses market-specific WAH wizard hints without UK WAH jargon on Poland", () => {
    expect(getPermitGuidance("work_at_height", "uk")?.wizardHint).toMatch(/WAH hierarchy/);
    expect(getPermitGuidance("roof_access", "uk")?.wizardHint).toMatch(/WAH hierarchy/);
    expect(getPermitGuidance("work_at_height", "pl")?.wizardHint).toMatch(/hierarchię BHP/i);
    expect(getPermitGuidance("work_at_height", "pl")?.wizardHint).not.toMatch(/WAH hierarchy/);
    expect(getPermitGuidance("roof_access", "pl")?.wizardHint).not.toMatch(/WAH hierarchy/);
    expect(getPermitGuidance("work_at_height", "au")?.wizardHint).toMatch(/WHS hierarchy/);
    expect(getPermitGuidance("work_at_height", "au")?.wizardHint).not.toMatch(/WAH hierarchy/);
  });
});

describe("hotWorkGuidance", () => {
  it("blocks fire watch under 60 minutes", () => {
    const r = hotWorkAssessment({ fireWatchDurationMins: 30, fireWatcher: "Alex" });
    expect(r.blockers.some((b) => /60/.test(b))).toBe(true);
  });

  it("renders GO panel when controls confirmed", () => {
    const svg = renderHotWorkGoNoGoSvg({
      combustiblesCleared10m: "yes",
      openingsSealed: "yes",
      extinguishersInPlace: "yes",
      fireBlanketInPlace: "yes",
      alarmIsolated: "yes",
      ventilationConfirmed: "yes",
      fireWatcher: "Sam",
    });
    expect(svg).toContain("GO");
  });

  it("includes hot work section in print HTML", () => {
    const html = renderGuidancePrintHtml({
      type: "hot_work",
      extraFields: {
        fireWatcher: "Sam",
        fireWatchDurationMins: DEFAULT_FIRE_WATCH_MINS,
        combustiblesCleared10m: "yes",
        openingsSealed: "yes",
        extinguishersInPlace: "yes",
        fireBlanketInPlace: "yes",
        alarmIsolated: "yes",
      },
    });
    expect(html).toContain("Hot work guidance");
    expect(html).toContain("<svg");
    expect(html).toMatch(/Fire watch/i);
  });

  it("renders fire watch timeline with duration", () => {
    const svg = renderFireWatchTimelineSvg({ durationMins: 90 });
    expect(svg).toContain("90 min");
  });
});

describe("wahGuidance", () => {
  it("warns on MEWP without IPAF", () => {
    const r = wahAssessment({ accessEquipment: "MEWP", maxHeight: 8 }, "uk");
    expect(r.warnings.some((w) => /IPAF/i.test(w))).toBe(true);
  });

  it("keeps UK WAHR/IPAF/ScaffTag copy on UK WAH print", () => {
    const html = renderWahPrintHtml(
      { type: "work_at_height", extraFields: { accessEquipment: "MEWP" } },
      { marketId: "uk" }
    );
    expect(html).toMatch(/Work at Height Regulations 2005/);
    expect(html).toMatch(/IPAF/);
    expect(html).toMatch(/ScaffTag|SG4|Scaffold tag/i);
  });

  it("drops UK WAHR/IPAF/ScaffTag copy on Poland and Australia WAH print", () => {
    const pl = renderWahPrintHtml(
      { type: "work_at_height", extraFields: { accessEquipment: "MEWP" } },
      { marketId: "pl" }
    );
    const au = renderWahPrintHtml(
      { type: "work_at_height", extraFields: { accessEquipment: "MEWP" } },
      { marketId: "au" }
    );
    expect(pl).toMatch(/BHP|UDT/);
    expect(pl).not.toMatch(/IPAF|ScaffTag|WAHR|Work at Height Regulations 2005/i);
    expect(wahAssessment({ accessEquipment: "MEWP", maxHeight: 8 }, "pl").warnings.join(" ")).toMatch(/UDT/);
    expect(wahAssessment({ accessEquipment: "MEWP", maxHeight: 8 }, "pl").warnings.join(" ")).not.toMatch(/IPAF/);
    expect(au).toMatch(/WHS|EWPA|HRWL/);
    expect(au).not.toMatch(/IPAF|ScaffTag|WAHR|Work at Height Regulations 2005/i);
    expect(wahAssessment({ accessEquipment: "MEWP", maxHeight: 8 }, "au").warnings.join(" ")).toMatch(/EWPA|HRWL/);
    expect(wahAssessment({ accessEquipment: "MEWP", maxHeight: 8 }, "au").warnings.join(" ")).not.toMatch(/IPAF/);
    const plPanel = renderToStaticMarkup(
      createElement(PermitWahGuidancePanel, { permitType: "work_at_height", marketId: "pl" })
    );
    const auPanel = renderToStaticMarkup(
      createElement(PermitWahGuidancePanel, { permitType: "work_at_height", marketId: "au" })
    );
    expect(plPanel).toMatch(/BHP|UDT|PIP/);
    expect(plPanel).not.toMatch(/IPAF|ScaffTag|WAH Regulations 2005|hse\.gov\.uk/i);
    expect(plPanel).not.toMatch(/WAH hierarchy/);
    expect(auPanel).toMatch(/WHS|EWPA|HRWL/);
    expect(auPanel).not.toMatch(/IPAF|ScaffTag|WAH Regulations 2005|hse\.gov\.uk/i);
  });

  it("renders hierarchy SVG", () => {
    const svg = renderWahHierarchySvg({ highlight: "prevent" });
    expect(svg).toContain("Prevent");
  });
});

describe("confinedSpaceGuidance", () => {
  it("blocks unsafe O2 reading", () => {
    const r = confinedSpaceAssessment({ o2Reading: "18", coReading: "5", h2sReading: "0", lelReading: "2" });
    expect(r.blockers.some((b) => /O₂/i.test(b))).toBe(true);
  });

  it("renders gauge panel", () => {
    const svg = renderConfinedGaugeSvg({ o2Reading: "20.9", coReading: "5", h2sReading: "0", lelReading: "3" });
    expect(svg).toContain("O₂");
    expect(svg).toContain("20.9%");
  });

  it("keeps UK CSR 1997 / HSE L101 copy on UK confined-space print", () => {
    const html = renderConfinedPrintHtml(
      { type: "confined_space", extraFields: { o2Reading: "20.9" } },
      { marketId: "uk" }
    );
    expect(html).toMatch(/Confined Spaces Regulations 1997/);
    expect(html).toMatch(/HSE L101/);
  });

  it("drops UK CSR 1997 / HSE L101 copy on Poland and Australia confined-space print", () => {
    const pl = renderConfinedPrintHtml(
      { type: "confined_space", extraFields: { o2Reading: "20.9" } },
      { marketId: "pl" }
    );
    const au = renderConfinedPrintHtml(
      { type: "confined_space", extraFields: { o2Reading: "20.9" } },
      { marketId: "au" }
    );
    expect(pl).toMatch(/BHP|przestrzeń zamknięta/i);
    expect(pl).not.toMatch(/Confined Spaces Regulations 1997|HSE L101/i);
    expect(au).toMatch(/WHS|AS 2865/);
    expect(au).not.toMatch(/Confined Spaces Regulations 1997|HSE L101/i);
    const plPanel = renderToStaticMarkup(
      createElement(PermitConfinedSpaceGuidancePanel, { marketId: "pl" })
    );
    const auPanel = renderToStaticMarkup(
      createElement(PermitConfinedSpaceGuidancePanel, { marketId: "au" })
    );
    expect(plPanel).toMatch(/PIP/);
    expect(plPanel).not.toMatch(/hse\.gov\.uk/i);
    expect(auPanel).toMatch(/Safe Work Australia/);
    expect(auPanel).not.toMatch(/hse\.gov\.uk/i);
  });
});
