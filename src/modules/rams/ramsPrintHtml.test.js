/** @vitest-environment jsdom */
import { describe, expect, it, beforeEach } from "vitest";
import { wrapRamsPrintDocument } from "./ramsPrintHtml.js";
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
});
