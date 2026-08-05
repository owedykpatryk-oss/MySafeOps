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

  it("never prints a CSS page counter in the fixed footer", () => {
    // Chrome only resolves the page counter inside @page margin boxes, which it does not
    // implement for HTML content. In this fixed footer it rendered "Page 0" on every page
    // of every RAMS pack — a wrong page number on a controlled safety document.
    const html = wrapRamsPrintDocument("Test", "<div>Body</div>", "", "meta", "#0f766e");
    expect(html).not.toContain("counter(page)");
    expect(html).not.toMatch(/class="page-num"/);
  });
});
