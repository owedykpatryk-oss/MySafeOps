import { describe, it, expect } from "vitest";
import { hasPermitGuidance, getPermitGuidance, renderGuidancePrintHtml } from "./registry";
import {
  hotWorkAssessment,
  renderFireWatchTimelineSvg,
  renderHotWorkGoNoGoSvg,
  DEFAULT_FIRE_WATCH_MINS,
} from "./hotWorkGuidance";
import { wahAssessment, renderWahHierarchySvg } from "./wahGuidance";
import { confinedSpaceAssessment, renderConfinedGaugeSvg } from "./confinedSpaceGuidance";

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
    const r = wahAssessment({ accessEquipment: "MEWP", maxHeight: 8 });
    expect(r.warnings.some((w) => /IPAF/i.test(w))).toBe(true);
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
});
