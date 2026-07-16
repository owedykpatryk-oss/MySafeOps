/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from "vitest";
import { setOrgId } from "./orgStorage";
import { saveOrgSettingsRaw } from "./orgSettingsStorage";
import { UTILITY_MAPPING_PACK_ID } from "./utilityMappingWorkspaceProfile";
import {
  getUtilityMappingProjectJob,
  syncUtilityMappingProjectJob,
  applyUtilityMappingProjectJobToDoc,
} from "./utilityMappingProjectJob";
import {
  buildUtilityMappingClientPackHtml,
  buildUtilityMappingClientMailto,
  buildUtilityMappingQrSrc,
} from "./utilityMappingClientPack";
import { computeUtilityMappingDigRisk, buildUtilityMappingDrawingSheets } from "./utilityMappingPremiumPages";
import { renderUtilityMappingHeroCover } from "./utilityMappingCovers";

function setUmOrg() {
  setOrgId("utility-mapping");
  saveOrgSettingsRaw({
    name: "Utility Mapping",
    website: "https://u-map.co.uk/",
    industryPackId: UTILITY_MAPPING_PACK_ID,
    hiddenModules: [],
    hiddenModulesBootstrapped: true,
  });
}

function setOtherOrg() {
  setOrgId("acme-ltd");
  saveOrgSettingsRaw({
    name: "Acme",
    website: "https://example.com/",
    hiddenModules: [],
    hiddenModulesBootstrapped: true,
  });
}

describe("Utility Mapping project job + client pack", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("resolves and syncs project job only for UM org", () => {
    setOtherOrg();
    expect(getUtilityMappingProjectJob({ umJobNumber: "12", umClientCode: "WSP" }).jobRef).toBe("");

    setUmOrg();
    const synced = syncUtilityMappingProjectJob({
      umJobNumber: "1234",
      umClientCode: "WSP",
      timelineStart: "2026-03-01",
    });
    expect(synced.code).toBe("UM26-1234-WSP");
    expect(synced.client).toBe("WSP");
    expect(getUtilityMappingProjectJob(synced).jobRef).toBe("UM26-1234-WSP");
  });

  it("applies project job onto survey / GPR / RAMS / MS docs", () => {
    setUmOrg();
    const project = syncUtilityMappingProjectJob({
      umJobNumber: "55",
      umClientCode: "JAC",
      timelineStart: "2026-01-15",
    });
    const survey = applyUtilityMappingProjectJobToDoc({ title: "S" }, project, "SR");
    expect(survey.ref).toBe("UM26-55-JAC");
    expect(survey.umJobNumber).toBe("55");

    const gpr = applyUtilityMappingProjectJobToDoc({ title: "G" }, project, "GPR");
    expect(gpr.ref).toBe("UM26-55-JAC-GPR");

    const ra = applyUtilityMappingProjectJobToDoc({ title: "R" }, project, "RA");
    expect(ra.documentNo).toBe("UM26-55-JAC-RA");

    const ms = applyUtilityMappingProjectJobToDoc({ title: "M" }, project, "MS");
    expect(ms.jobRef).toBe("UM26-55-JAC-MS");

    setOtherOrg();
    expect(applyUtilityMappingProjectJobToDoc({ ref: "X" }, project, "SR").ref).toBe("X");
  });

  it("builds dig risk, drawing sheets and client pack only for UM", () => {
    setOtherOrg();
    expect(computeUtilityMappingDigRisk({ utilitiesTable: [{}] }).label).toBe("");
    expect(buildUtilityMappingClientPackHtml({ ref: "UM26-1-WSP" })).toBe("");

    setUmOrg();
    const dig = computeUtilityMappingDigRisk({
      utilitiesTable: [{}, {}, {}, {}, {}, {}],
      pas128Ql: "QL-B4",
      trialHolesTable: [],
    });
    expect(dig.score).toBeGreaterThan(40);
    expect(dig.label).toBeTruthy();

    const sheets = buildUtilityMappingDrawingSheets({ ref: "UM26-99-WSP", documentControl: { revision: "B" } });
    expect(sheets[0].sheet).toMatch(/^UM26-99-WSP/);
    expect(sheets[0].status).toContain("B");

    const custom = buildUtilityMappingDrawingSheets({
      ref: "UM26-99-WSP",
      drawingSheets: [{ sheet: "A1", title: "Custom", scale: "1:500", status: "Rev C" }],
    });
    expect(custom).toHaveLength(1);
    expect(custom[0].sheet).toBe("A1");

    const html = buildUtilityMappingClientPackHtml(
      {
        ref: "UM26-99-WSP",
        title: "PAS128",
        client: "WSP",
        status: "final",
        utilitiesTable: [],
      },
      { shareUrl: "https://u-map.co.uk/?ref=UM26-99-WSP" }
    );
    expect(html).toContain("Client issue pack");
    expect(html).toContain("CONTROLLED");
    expect(html).toContain("quickchart.io/qr");

    const mail = buildUtilityMappingClientMailto({ ref: "UM26-99-WSP", siteAddress: "Site Rd" });
    expect(mail).toMatch(/^mailto:/);
    expect(mail).toContain("UM26-99-WSP");
    expect(buildUtilityMappingQrSrc("hello", 80)).toContain("quickchart.io/qr");
  });

  it("renders cover QR when provided", () => {
    setUmOrg();
    const html = renderUtilityMappingHeroCover({
      title: "Test",
      qrSrc: buildUtilityMappingQrSrc("https://u-map.co.uk/?ref=UM26-1-WSP", 120),
      qrLabel: "UM26-1-WSP",
    });
    expect(html).toContain("um-hero-cover__qr");
    expect(html).toContain("UM26-1-WSP");
  });
});
