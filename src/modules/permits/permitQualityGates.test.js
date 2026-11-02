import { describe, it, expect } from "vitest";
import { runPermitQualityGates } from "./permitQualityGates";

describe("runPermitQualityGates", () => {
  it("passes when all core fields valid", () => {
    const r = runPermitQualityGates({
      description: "Work",
      location: "A1",
      issuedBy: "Alice",
      issuedTo: "Bob",
      startDateTime: "2026-04-09T08:00:00.000Z",
      endDateTime: "2026-04-09T10:00:00.000Z",
    });
    expect(r.ok).toBe(true);
    expect(r.failed).toHaveLength(0);
  });

  it("fails when time range invalid", () => {
    const r = runPermitQualityGates({
      description: "Work",
      location: "A1",
      issuedBy: "Alice",
      issuedTo: "Bob",
      startDateTime: "2026-04-09T10:00:00.000Z",
      endDateTime: "2026-04-09T08:00:00.000Z",
    });
    expect(r.ok).toBe(false);
    expect(r.failed.some((f) => f.id === "timeRange")).toBe(true);
  });

  it("allows optional issuedTo when configured", () => {
    const r = runPermitQualityGates(
      {
        description: "Work",
        location: "A1",
        issuedBy: "Alice",
        issuedTo: "",
        startDateTime: "2026-04-09T08:00:00.000Z",
        endDateTime: "2026-04-09T10:00:00.000Z",
      },
      { required: { issuedTo: false } }
    );
    expect(r.ok).toBe(true);
  });

  it("returns contextual smart recommendations for hot work", () => {
    const r = runPermitQualityGates(
      {
        type: "hot_work",
        description: "Welding in plant room",
        location: "A1",
        issuedBy: "Alice",
        issuedTo: "Bob",
        startDateTime: "2026-04-09T08:00:00.000Z",
        endDateTime: "2026-04-09T10:00:00.000Z",
        notes: "",
        evidenceNotes: "",
        checklist: {},
        checklistItems: [],
      },
      { dynamicMissing: ["Fire watch (minutes)"] }
    );
    expect(r.ok).toBe(true);
    expect(Array.isArray(r.recommendations)).toBe(true);
    expect(r.recommendations.some((x) => String(x?.text || "").toLowerCase().includes("fire watch"))).toBe(true);
    expect(r.recommendations.some((x) => String(x?.text || "").toLowerCase().includes("rams"))).toBe(true);
    expect(r.recommendations.some((x) => x?.autofix)).toBe(true);
  });

  it("uses Polish fire-watch quality-gate copy on Poland hot work", () => {
    const r = runPermitQualityGates(
      {
        type: "hot_work",
        description: "Spawanie",
        location: "Warszawa",
        issuedBy: "Anna",
        issuedTo: "Jan",
        startDateTime: "2026-04-09T08:00:00.000Z",
        endDateTime: "2026-04-09T10:00:00.000Z",
        notes: "Fire controls: 2x extinguishers and fire blanket in place.",
        evidenceNotes: "",
        extraFields: {},
        checklist: {},
        checklistItems: [],
      },
      { marketId: "pl" }
    );
    const texts = r.recommendations.map((x) => String(x?.text || "")).join(" ");
    expect(texts).toMatch(/dyżuru pożarowego/i);
    expect(texts).not.toMatch(/HSE|Fire Safety Order/i);
    expect(r.recommendations.some((x) => /fire watch/i.test(String(x?.text || "")))).toBe(false);
  });

  it("uses Polish extinguisher/fire-blanket quality-gate copy on Poland hot work", () => {
    const r = runPermitQualityGates(
      {
        type: "hot_work",
        description: "Spawanie",
        location: "Warszawa",
        issuedBy: "Anna",
        issuedTo: "Jan",
        startDateTime: "2026-04-09T08:00:00.000Z",
        endDateTime: "2026-04-09T10:00:00.000Z",
        notes: "",
        evidenceNotes: "",
        extraFields: { fireWatcher: "Jan", fireWatchDurationMins: 60 },
        checklist: { hw1: true },
        checklistItems: [{ id: "hw1", text: "Osoba na dyżurze pożarowym wyznaczona i poinstruowana" }],
      },
      { marketId: "pl" }
    );
    const fireControls = r.recommendations.find((x) => x.id === "hot_work_fire_controls");
    expect(fireControls?.text).toMatch(/gaśnice|koc gaśniczy/i);
    expect(fireControls?.text).not.toMatch(/extinguisher|fire blanket/i);
    expect(fireControls?.autofix?.text).toMatch(/gaśnice|koc gaśniczy/i);
    expect(fireControls?.autofix?.text).not.toMatch(/extinguisher|fire blanket/i);

    const suppressed = runPermitQualityGates(
      {
        type: "hot_work",
        description: "Spawanie",
        location: "Warszawa",
        issuedBy: "Anna",
        issuedTo: "Jan",
        startDateTime: "2026-04-09T08:00:00.000Z",
        endDateTime: "2026-04-09T10:00:00.000Z",
        notes: "Zabezpieczenia ppoż.: 2× gaśnice i koc gaśniczy na stanowisku.",
        extraFields: { fireWatcher: "Jan", fireWatchDurationMins: 60 },
        checklist: { hw1: true },
        checklistItems: [{ id: "hw1", text: "Osoba na dyżurze pożarowym wyznaczona i poinstruowana" }],
      },
      { marketId: "pl" }
    );
    expect(suppressed.recommendations.some((x) => x.id === "hot_work_fire_controls")).toBe(false);
  });

  it("does not recommend PAS 128 / CAT scan on Poland excavation permits", () => {
    const r = runPermitQualityGates(
      {
        type: "excavation",
        description: "Wykop próbny",
        location: "Warszawa",
        issuedBy: "Anna",
        issuedTo: "Jan",
        startDateTime: "2026-04-09T08:00:00.000Z",
        endDateTime: "2026-04-09T10:00:00.000Z",
        notes: "",
        evidenceNotes: "",
        extraFields: {},
      },
      { marketId: "pl" }
    );
    expect(r.recommendations.some((x) => /PAS 128|CAT scan/i.test(String(x?.text || "")))).toBe(false);
  });

  it("still recommends PAS 128 on UK excavation permits", () => {
    const r = runPermitQualityGates(
      {
        type: "excavation",
        description: "Trial pit",
        location: "Leeds",
        issuedBy: "Alice",
        issuedTo: "Bob",
        startDateTime: "2026-04-09T08:00:00.000Z",
        endDateTime: "2026-04-09T10:00:00.000Z",
        notes: "",
        evidenceNotes: "",
        extraFields: {},
      },
      { marketId: "uk" }
    );
    expect(r.recommendations.some((x) => /PAS 128/i.test(String(x?.text || "")))).toBe(true);
  });

  it("uses Polish LOTO quality-gate copy on Poland electrical permits", () => {
    const pl = runPermitQualityGates(
      {
        type: "electrical",
        description: "Prace przy rozdzielnicy",
        location: "Warszawa",
        issuedBy: "Anna",
        issuedTo: "Jan",
        startDateTime: "2026-04-09T08:00:00.000Z",
        endDateTime: "2026-04-09T10:00:00.000Z",
        notes: "",
        evidenceNotes: "",
      },
      { marketId: "pl" }
    );
    const loto = pl.recommendations.find((x) => x.id === "loto_evidence");
    expect(loto?.text).toMatch(/odłączenia/i);
    expect(loto?.text).not.toMatch(/Isolation task|try-test/i);
    expect(loto?.autofix?.text).toMatch(/kłódki/i);
    expect(loto?.autofix?.text).not.toMatch(/try-test/i);

    const uk = runPermitQualityGates(
      {
        type: "electrical",
        description: "Isolate board",
        location: "Leeds",
        issuedBy: "Alice",
        issuedTo: "Bob",
        startDateTime: "2026-04-09T08:00:00.000Z",
        endDateTime: "2026-04-09T10:00:00.000Z",
        notes: "",
        evidenceNotes: "",
      },
      { marketId: "uk" }
    );
    const ukLoto = uk.recommendations.find((x) => x.id === "loto_evidence");
    expect(ukLoto?.text).toMatch(/Isolation task: capture LOTO/);
    expect(ukLoto?.autofix?.text).toMatch(/try-test completed/);
  });

  it("uses Polish confined-space quality-gate copy on Poland", () => {
    const r = runPermitQualityGates(
      {
        type: "confined_space",
        description: "Wejście do komory",
        location: "Warszawa",
        issuedBy: "Anna",
        issuedTo: "Jan",
        startDateTime: "2026-04-09T08:00:00.000Z",
        endDateTime: "2026-04-09T10:00:00.000Z",
        extraFields: {},
      },
      { marketId: "pl" }
    );
    const rescue = r.recommendations.find((x) => x.id === "confined_space_rescue_ref");
    const gas = r.recommendations.find((x) => x.id === "confined_space_gas_tester");
    expect(rescue?.text).toMatch(/planu ratowniczego/i);
    expect(rescue?.text).not.toMatch(/Confined space: add rescue/i);
    expect(gas?.text).toMatch(/tester gazów/i);
    expect(gas?.autofix?.value).toMatch(/Wyznaczony tester gazów/);
    expect(gas?.text).not.toMatch(/Assigned gas tester/i);
  });

  it("does not recommend PAS 128 / CAT scan on Australia ground-disturbance permits", () => {
    const r = runPermitQualityGates(
      {
        type: "ground_disturbance",
        description: "Piling near services",
        location: "Sydney",
        issuedBy: "Alex",
        issuedTo: "Sam",
        startDateTime: "2026-04-09T08:00:00.000Z",
        endDateTime: "2026-04-09T10:00:00.000Z",
        notes: "",
        evidenceNotes: "",
        extraFields: {},
      },
      { marketId: "au" }
    );
    expect(r.recommendations.some((x) => /PAS 128|CAT scan/i.test(String(x?.text || "")))).toBe(false);
  });

  it("uses Polish generic quality-gate recs on Poland, keeping UK English", () => {
    const base = {
      type: "general",
      description: "Prace ogolne",
      location: "A",
      issuedBy: "Anna",
      issuedTo: "Jan",
      startDateTime: "2026-04-09T08:00:00.000Z",
      endDateTime: "2026-04-09T10:00:00.000Z",
    };
    const pl = runPermitQualityGates(base, { marketId: "pl" });
    const plTexts = pl.recommendations.map((x) => String(x?.text || "")).join(" | ");
    expect(pl.recommendations.find((x) => x.id === "link_rams")?.text).toMatch(/IBWR \/ RAMS/);
    expect(pl.recommendations.find((x) => x.id === "evidence_photo")?.text).toMatch(/zdjęcie dowodowe/);
    expect(pl.recommendations.find((x) => x.id === "precise_location")?.text).toMatch(/Uściślij lokalizację/);
    expect(plTexts).not.toMatch(/Link RAMS for stronger|Attach one site evidence photo|Refine location to exact/);

    const uk = runPermitQualityGates(
      { ...base, description: "General works", location: "A", issuedBy: "Alice", issuedTo: "Bob" },
      { marketId: "uk" }
    );
    expect(uk.recommendations.find((x) => x.id === "link_rams")?.text).toBe("Link RAMS for stronger legal traceability.");
    expect(uk.recommendations.find((x) => x.id === "evidence_photo")?.text).toBe("Attach one site evidence photo before issue.");
    expect(uk.recommendations.find((x) => x.id === "precise_location")?.text).toBe("Refine location to exact zone/area reference.");
  });
});
