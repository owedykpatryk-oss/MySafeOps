import { describe, it, expect } from "vitest";
import { evaluateRamsCoshhGate, evaluateRamsHospitalGate } from "./ramsComplianceGates";
import { snapshotRamsForPermit, attachRamsSnapshotOnIssue } from "./permitRamsSnapshot";

describe("ramsComplianceGates", () => {
  it("passes COSHH gate when no chemical hints in scope", () => {
    const result = evaluateRamsCoshhGate({ title: "General survey" }, [{ activity: "Topo", hazard: "Traffic" }]);
    expect(result.ok).toBe(true);
    expect(result.required).toBe(false);
  });

  it("blocks COSHH gate when sealant mentioned but no SDS", () => {
    const result = evaluateRamsCoshhGate(
      { scope: "Apply silicone sealant to panel joints" },
      [],
      { coshhItems: [{ name: "Silicone sealant", sdsUrl: "" }] }
    );
    expect(result.required).toBe(true);
    expect(result.ok).toBe(false);
    expect(result.missing.length).toBeGreaterThan(0);
  });

  it("requires nearest A&E when project has coordinates", () => {
    const blocked = evaluateRamsHospitalGate({}, { lat: 51.5, lng: -0.1 });
    expect(blocked.required).toBe(true);
    expect(blocked.ok).toBe(false);
    const ok = evaluateRamsHospitalGate({ nearestHospital: "St Thomas A&E" }, { lat: 51.5, lng: -0.1 });
    expect(ok.ok).toBe(true);
  });
});

describe("permitRamsSnapshot", () => {
  it("returns null when no rams id", () => {
    expect(snapshotRamsForPermit("")).toBeNull();
  });

  it("attachRamsSnapshotOnIssue preserves permit when no linked rams", () => {
    const p = { id: "p1", status: "active" };
    expect(attachRamsSnapshotOnIssue(p)).toEqual(p);
  });
});
