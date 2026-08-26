/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from "vitest";
import {
  buildDachComplianceData,
  buildDachComplianceSnapshotHtml,
  supportsDachComplianceSnapshot,
} from "./dachComplianceSnapshot";

beforeEach(() => {
  localStorage.clear();
});

describe("dachComplianceSnapshot", () => {
  it("only supports DE/AT/CH markets", () => {
    expect(supportsDachComplianceSnapshot("de")).toBe(true);
    expect(supportsDachComplianceSnapshot("at")).toBe(true);
    expect(supportsDachComplianceSnapshot("ch")).toBe(true);
    expect(supportsDachComplianceSnapshot("uk")).toBe(false);
    expect(supportsDachComplianceSnapshot("pl")).toBe(false);
    expect(supportsDachComplianceSnapshot("au")).toBe(false);
  });

  it("builds compliance data with empty registers", () => {
    const data = buildDachComplianceData("de");
    expect(data.activeSigePlan).toBeNull();
    expect(data.cdmPackCount).toBe(0);
    expect(data.openPermits).toEqual([]);
    expect(data.anhangCoverage).toHaveLength(10);
  });

  it("detects active SiGe-Plan / GBU pack", () => {
    localStorage.setItem(
      "cdm_packs_default",
      JSON.stringify([{ id: "pack1", status: "active", title: "Test SiGe-Plan" }])
    );
    const data = buildDachComplianceData("de");
    expect(data.activeSigePlan).not.toBeNull();
    expect(data.cdmPackCount).toBe(1);
  });

  it("counts open permits by status", () => {
    localStorage.setItem(
      "permits_v2_default",
      JSON.stringify([
        { id: "p1", status: "active", type: "hot_work", startDateTime: new Date().toISOString() },
        { id: "p2", status: "closed", type: "excavation" },
        { id: "p3", status: "approved", type: "work_at_height" },
      ])
    );
    const data = buildDachComplianceData("de");
    expect(data.openPermits).toHaveLength(2);
  });

  it("flags permits active over 30 days as expired-review", () => {
    const oldDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
    localStorage.setItem(
      "permits_v2_default",
      JSON.stringify([{ id: "p1", status: "active", type: "hot_work", startDateTime: oldDate }])
    );
    const data = buildDachComplianceData("de");
    expect(data.expiredPermits).toHaveLength(1);
  });

  it("maps Anhang II coverage to linked permits", () => {
    localStorage.setItem(
      "permits_v2_default",
      JSON.stringify([{ id: "p1", status: "active", type: "hot_work" }])
    );
    const data = buildDachComplianceData("de");
    const explosionItem = data.anhangCoverage.find((i) => i.id === "explosives");
    expect(explosionItem.hasCoverage).toBe(true);
    expect(explosionItem.linkedCount).toBe(1);

    const divingItem = data.anhangCoverage.find((i) => i.id === "diving");
    expect(divingItem.hasCoverage).toBe(false);
  });

  it("identifies stale training records past expiry", () => {
    const pastDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    localStorage.setItem(
      "training_matrix_default",
      JSON.stringify([{ id: "t1", name: "Alice", expiryDate: pastDate }])
    );
    const data = buildDachComplianceData("de");
    expect(data.staleTraining).toHaveLength(1);
  });

  it("counts open incident actions and unclosed RIDDOR/BG reports", () => {
    localStorage.setItem(
      "mysafeops_incidents_default",
      JSON.stringify([{ id: "i1", status: "open" }, { id: "i2", status: "closed" }])
    );
    localStorage.setItem(
      "riddor_reports_default",
      JSON.stringify([{ id: "r1", status: "pending" }])
    );
    const data = buildDachComplianceData("de");
    expect(data.openIncidentActions).toHaveLength(1);
    expect(data.openRiddor).toHaveLength(1);
  });

  it("builds valid HTML for DE market with German copy", () => {
    const html = buildDachComplianceSnapshotHtml("de");
    expect(html).toContain("Prüfbereiter Nachweis");
    expect(html).toContain("SiGe-Plan");
    expect(html).toContain("Berufsgenossenschaft");
  });

  it("builds valid HTML for AT market with AUVA reference", () => {
    const html = buildDachComplianceSnapshotHtml("at");
    expect(html).toContain("Evaluierung");
    expect(html).toContain("AUVA");
  });

  it("builds valid HTML for CH market with Suva reference", () => {
    const html = buildDachComplianceSnapshotHtml("ch");
    expect(html).toContain("SiKo");
    expect(html).toContain("Suva");
  });

  it("falls back to DE copy for unsupported market ids", () => {
    const html = buildDachComplianceSnapshotHtml("uk");
    expect(html).toContain("Prüfbereiter Nachweis");
  });

  it("includes disclaimer text about not being an official filing", () => {
    const html = buildDachComplianceSnapshotHtml("de");
    expect(html).toContain("ersetzt keine amtliche Meldung");
  });

  it("renders all 10 Anhang II work categories in the table", () => {
    const html = buildDachComplianceSnapshotHtml("de");
    expect(html).toContain("Absturz");
    expect(html).toContain("Verschüttung");
    expect(html).toContain("Explosion");
    expect(html).toContain("Fertigteile");
  });
});
