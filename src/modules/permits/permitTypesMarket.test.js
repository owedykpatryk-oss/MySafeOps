import { describe, expect, it } from "vitest";
import { getPermitTypesForMarket } from "./permitTypesMarket";

describe("permitTypesMarket", () => {
  it("returns UK types unchanged", () => {
    const uk = getPermitTypesForMarket("uk");
    expect(uk.electrical.checklist.some((x) => /GS38/i.test(x))).toBe(true);
  });

  it("returns AU electrical checklist with AS/NZS reference", () => {
    const au = getPermitTypesForMarket("au");
    expect(au.electrical.checklist.some((x) => /AS\/NZS 3012/i.test(x))).toBe(true);
    expect(au.excavation.checklist.some((x) => /Dial Before You Dig/i.test(x))).toBe(true);
  });

  it("returns German Erlaubnisschein labels with Anhang II hints", () => {
    const de = getPermitTypesForMarket("de");
    expect(de.hot_work.label).toMatch(/Heißarbeiten/);
    expect(de.excavation.checklist.some((x) => /Leitungsauskunft/i.test(x))).toBe(true);
    expect(de.work_at_height.description).toMatch(/Anhang II/i);
    expect(de.excavation.description).toMatch(/Anhang II/i);
  });

  it("reuses German permit pack for Austria, annotated with BauKG (not BaustellV)", () => {
    const at = getPermitTypesForMarket("at");
    expect(at.hot_work.label).toMatch(/Heißarbeiten/);
    expect(at.work_at_height.description).toMatch(/BauKG/);
    expect(at.work_at_height.description).not.toMatch(/BaustellV/);
  });

  it("reuses German permit pack for Switzerland with Freigabe labels and BauAV annotation", () => {
    const ch = getPermitTypesForMarket("ch");
    expect(ch.hot_work.label).toMatch(/^Freigabe Heißarbeiten/);
    expect(ch.hot_work.label).not.toMatch(/Erlaubnisschein/);
    expect(ch.general.label).toBe("Allgemeine Freigabe");
    expect(ch.work_at_height.description).toMatch(/BauAV/);
    expect(ch.work_at_height.description).not.toMatch(/BaustellV|BauKG/);
    expect(ch.excavation.checklist.some((x) => /Leitungsauskunft/i.test(x))).toBe(true);
  });
});
