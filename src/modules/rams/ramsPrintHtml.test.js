/** @vitest-environment jsdom */
import { describe, expect, it, beforeEach } from "vitest";
import { wrapRamsPrintDocument, generatePrintHTML } from "./ramsPrintHtml.js";
import { saveOrgSettingsRaw } from "../../utils/orgSettingsStorage.js";

describe("ramsPrintHtml", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("mysafeops_orgId", "test-org");
    saveOrgSettingsRaw({
      name: "Acme Civils",
      primaryColor: "#b91c1c",
      accentColor: "#f97316",
      pdfComplianceLine: "Controlled copy — do not use on site without approval.",
    });
  });

  it("wrapRamsPrintDocument applies org primary colour and compliance line", () => {
    const html = wrapRamsPrintDocument(
      "Test RAMS",
      "<div class='rams-content'><p>Body</p></div>",
      "",
      "DOC-1 · issued",
      {
        primaryColor: "#b91c1c",
        accentColor: "#f97316",
        complianceLine: "Controlled copy — do not use on site without approval.",
      }
    );
    expect(html).toContain("#b91c1c");
    expect(html).toContain("Controlled copy");
    expect(html).toContain("Segoe UI");
    expect(html).toContain("page-footer");
  });

  it("embeds operative ink signatures in the sign-off table", () => {
    const html = generatePrintHTML(
      {
        title: "RAMS ink",
        location: "Yard",
        operativeIds: ["w1"],
        operativeSignatures: {
          w1: { name: "Alex", imageDataUrl: "data:image/png;base64,aaa", signedAt: "2026-04-14T10:00:00.000Z" },
        },
        printSections: { signatures: true },
      },
      [],
      ["Alex"],
      {},
      { signatures: true },
      "fp",
      [{ id: "w1", name: "Alex" }]
    );
    expect(html).toContain("Sign-off list");
    expect(html).toContain("data:image/png;base64,aaa");
    expect(html).toContain("Alex");
  });

  it("renders an IOR with Polish headings and Polish legal references", () => {
    localStorage.setItem(
      "mysafeops_active_country_workspace_snapshot_test-org",
      JSON.stringify({ id: "ws-pl", market_id: "pl", default_document_locale: "pl-PL", is_primary: false }),
    );
    const html = generatePrintHTML(
      { title: "IOR — prace instalacyjne", location: "Warszawa", documentStatus: "issued" },
      [
        {
          activity: "Montaż instalacji",
          hazard: "Kontakt z energią",
          initialRisk: { L: 4, S: 4 },
          revisedRisk: { L: 2, S: 2 },
          controlMeasures: ["Odłączyć i zabezpieczyć źródło energii"],
          ppeRequired: ["Kask"],
          regs: ["CDM 2015"],
        },
      ],
      [],
      {},
      { hazards: true },
      "fp",
      [],
    );
    expect(html).toContain('lang="pl-PL"');
    expect(html).toContain("Ocena ryzyka i środki kontroli");
    expect(html).toContain("Kodeks pracy");
    expect(html).not.toContain("CDM 2015");
  });

  it("keeps UK hazard regs on print and falls back to HSE pack when empty", () => {
    localStorage.setItem(
      "mysafeops_active_country_workspace_snapshot_test-org",
      JSON.stringify({ id: "ws-uk", market_id: "uk", default_document_locale: "en-GB", is_primary: true }),
    );
    const withRegs = generatePrintHTML(
      { title: "RAMS — UK site", location: "Bristol", documentStatus: "issued" },
      [
        {
          activity: "Excavation",
          hazard: "Buried services",
          initialRisk: { L: 4, S: 4 },
          revisedRisk: { L: 2, S: 2 },
          controlMeasures: ["CAT and Genny before dig"],
          ppeRequired: ["Hard hat"],
          regs: ["CDM 2015", "HSG47"],
        },
      ],
      [],
      {},
      { hazards: true },
      "fp",
      [],
    );
    expect(withRegs).toContain('lang="en-GB"');
    expect(withRegs).toContain("Risk assessment and controls");
    expect(withRegs).toContain("CDM 2015");
    expect(withRegs).toContain("HSG47");
    expect(withRegs).not.toContain("Kodeks pracy");

    const emptyRegs = generatePrintHTML(
      { title: "RAMS — UK defaults", location: "Bristol", documentStatus: "issued" },
      [
        {
          activity: "General site work",
          hazard: "Slips and trips",
          initialRisk: { L: 3, S: 3 },
          revisedRisk: { L: 2, S: 2 },
          controlMeasures: ["Housekeeping"],
          ppeRequired: ["Safety boots"],
          regs: [],
        },
      ],
      [],
      {},
      { hazards: true },
      "fp",
      [],
    );
    expect(emptyRegs).toContain("Construction (Design and Management) Regulations 2015");
    expect(emptyRegs).toContain("Health and Safety at Work etc. Act 1974");
  });
});
