/** @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { blankSurveyReport } from "../modules/surveyReport/surveyReportConstants.js";
import { buildSurveyReportHtml } from "../modules/surveyReport/surveyReportPrintHtml.js";
import { renderPermitDocumentHtml } from "../modules/permits/permitDocumentHtml.js";
import { generatePrintHTML } from "../modules/rams/ramsPrintHtml.js";
import { buildDocReference, renderPrintDocFooter, renderPrintDocHeader } from "./pdfBranding.js";
import { setOrgId } from "./orgStorage.js";
import { loadOrgSettingsRaw, saveOrgSettingsRaw } from "./orgSettingsStorage.js";
import { ensureUtilityMappingBranding } from "./utilityMappingBranding.js";
import { isUtilityMappingOrg } from "./utilityMappingOrg.js";
import { isUtilityMappingPrintTheme } from "./utilityMappingPrintTheme.js";

const BARNES_BRAND = {
  name: "Barnes Fernández",
  website: "https://barnesfernandez.com/",
  email: "admin@barnesfernandez.com",
  primaryColor: "#174F78",
  accentColor: "#55B8D4",
  pdfHeader: "Barnes Fernández — Surveying & Civil Engineering",
  pdfFooter: "Barnes Fernández · barnesfernandez.com",
  pdfTheme: "executive",
  pdfVersionPrefix: "BF",
  pdfComplianceLine: "Controlled document. Ensure the latest approved revision is in use.",
  industryPackId: "surveyingGeodesy",
  logoUrl: "/branding/barnes-fernandez-logo.png",
  logo: "/branding/barnes-fernandez-logo.png",
};

const JOIN_LINKS_SQL = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260731103000_barnes_fernandez_join_links.sql"),
  "utf8"
);

function seedBarnesOrg() {
  localStorage.clear();
  setOrgId("barnes-fernandez");
  saveOrgSettingsRaw({ ...BARNES_BRAND });
  localStorage.setItem(
    "mysafeops_active_country_workspace_snapshot_barnes-fernandez",
    JSON.stringify({ id: "ws-uk", market_id: "uk", default_document_locale: "en-GB", is_primary: true })
  );
}

function sliceSqlFunction(sql, name) {
  const start = sql.indexOf(`create function public.${name}(`);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = sql.indexOf(`revoke all on function public.${name}`, start);
  expect(end).toBeGreaterThan(start);
  return sql.slice(start, end);
}

describe("Barnes Fernández onboarding contract", () => {
  it("stores hashed join links, domain restriction, and surveying branding without Utility Mapping copy", () => {
    expect(JOIN_LINKS_SQL).toContain("create table if not exists public.org_join_links");
    expect(JOIN_LINKS_SQL).toContain("token_hash text not null unique");
    expect(JOIN_LINKS_SQL).toMatch(/Tokens are stored only as SHA-256 hashes/);
    expect(JOIN_LINKS_SQL).not.toMatch(/insert into public\.org_join_links[\s\S]*invite_token\s*=/i);
    expect(JOIN_LINKS_SQL).toContain("'barnes-fernandez'");
    expect(JOIN_LINKS_SQL).toContain("'barnesfernandez.com'");
    expect(JOIN_LINKS_SQL).toContain("'admin@barnesfernandez.com'");
    expect(JOIN_LINKS_SQL).toContain("'surveyingGeodesy'");
    expect(JOIN_LINKS_SQL).toContain("'operative'");
    expect(JOIN_LINKS_SQL).toContain("'admin'");
    expect(JOIN_LINKS_SQL).toContain("2028-07-31");
    expect(JOIN_LINKS_SQL).toContain("2026-10-31");
    expect(JOIN_LINKS_SQL).toMatch(/b6b24f1a917607e0ff05adc13d4cc239821a0e867c95f8f2a07a0f54ffc7f074/);
    expect(JOIN_LINKS_SQL).toMatch(/d9db0ac889f86e9c91b52a7450c5b2f24261039938f4d59414c732baffc4009a/);
    expect(JOIN_LINKS_SQL).toMatch(/does not inherit[\s\S]*Utility Mapping tenant profile/);
    const brandingBlock = JOIN_LINKS_SQL.slice(JOIN_LINKS_SQL.indexOf("jsonb_build_object("));
    expect(brandingBlock).toContain("'surveyingGeodesy'");
    expect(brandingBlock).toContain("barnesfernandez.com");
    expect(brandingBlock).not.toContain("u-map.co.uk");
    expect(brandingBlock).not.toContain("/branding/utility-mapping");
  });

  it("rejects unverified email, domain/exact-email mismatch, and cross-org moves", () => {
    const ensureFn = sliceSqlFunction(JOIN_LINKS_SQL, "ensure_my_org");
    expect(ensureFn).toContain("v_email_confirmed_at is null");
    expect(ensureFn).toContain("Verify your email address before joining this organisation.");
    expect(ensureFn).toContain("This organisation link is restricted to a different email address.");
    expect(ensureFn).toContain("Use your verified company email address to join this organisation.");
    expect(ensureFn).toContain("split_part(v_email, '@', 2)");
    expect(ensureFn).toContain("Your account already belongs to another organisation.");
    expect(ensureFn).toContain("v_existing_org_id <> v_link.org_id");
    expect(ensureFn).toContain("pg_advisory_xact_lock");
  });

  it("never downgrades admin/supervisor and only counts a join link's first use", () => {
    const ensureFn = sliceSqlFunction(JOIN_LINKS_SQL, "ensure_my_org");
    expect(ensureFn).toMatch(/must never downgrade an existing member/);
    expect(ensureFn).toContain("when v_existing_role = 'admin' or v_link.role = 'admin' then 'admin'");
    expect(ensureFn).toContain(
      "when v_existing_role = 'supervisor' or v_link.role = 'supervisor' then 'supervisor'"
    );
    expect(ensureFn).toContain("on conflict (link_id, user_id) do nothing");
    expect(ensureFn).toContain("if v_inserted_use_count = 1 then");
    expect(ensureFn).toContain("j.use_count < j.max_uses");
    expect(ensureFn).toContain("j.token_hash = v_token_hash");
    expect(ensureFn).not.toMatch(/from public\.org_join_links[\s\S]*invite_token\s*=/);
  });
});

describe("Barnes Fernández H&S document isolation", () => {
  beforeEach(() => {
    seedBarnesOrg();
  });

  it("does not inherit Utility Mapping exclusive branding or print theme", () => {
    expect(isUtilityMappingOrg("barnes-fernandez")).toBe(false);
    expect(isUtilityMappingPrintTheme()).toBe(false);
    expect(ensureUtilityMappingBranding("barnes-fernandez")).toBe(false);
    expect(loadOrgSettingsRaw().primaryColor).toBe("#174F78");
    expect(loadOrgSettingsRaw().industryPackId).toBe("surveyingGeodesy");
    expect(loadOrgSettingsRaw().logoUrl).toBe("/branding/barnes-fernandez-logo.png");
  });

  it("prints Barnes survey branding with UK PAS 128 wording and no UM exclusive artwork", () => {
    const html = buildSurveyReportHtml(
      blankSurveyReport({
        title: "PAS 128 utility mapping — Southampton",
        ref: "BF-SUR-001",
        client: "Main contractor",
        surveyType: "utility_mapping_survey",
        pas128Ql: "B1",
        sections: { scope: "Locate buried utilities before excavation." },
      }),
      {}
    );
    expect(html).toContain("Barnes Fernández");
    expect(html).toContain("barnesfernandez.com");
    expect(html).toContain('lang="en-GB"');
    expect(html).toContain("PAS 128 quality levels");
    expect(html).not.toContain("um-hero-cover");
    expect(html).not.toContain("cover-hero.jpg");
    expect(html).not.toContain("/branding/utility-mapping-logo.png");
    expect(html).not.toContain("u-map.co.uk");
    expect(html).not.toContain("Part of IS GROUP");
  });

  it("prints Barnes PTW/RAMS packs without Utility Mapping covers", () => {
    const permitHtml = renderPermitDocumentHtml({
      id: "p-bf-1",
      type: "excavation",
      status: "active",
      description: "Trial trench",
      location: "Southampton",
      issuedBy: "A",
      issuedTo: "B",
      checklist: {},
      extraFields: { pas128QualityLevel: "QL-B", pas128SurveyType: "B1" },
    });
    expect(permitHtml).toContain("Barnes Fernández");
    expect(permitHtml).toContain("PAS 128");
    expect(permitHtml).not.toContain("um-hero-cover");
    expect(permitHtml).not.toContain("u-map.co.uk");

    const ramsHtml = generatePrintHTML(
      { title: "RAMS — Barnes site", location: "Southampton", documentStatus: "issued" },
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
      []
    );
    expect(ramsHtml).toContain("Barnes Fernández");
    expect(ramsHtml).toContain("CDM 2015");
    expect(ramsHtml).not.toContain("um-hero-cover");
    expect(ramsHtml).not.toContain("u-map.co.uk");
  });

  it("uses the BF document prefix and Barnes print footer", () => {
    expect(buildDocReference(BARNES_BRAND, "Survey")).toMatch(/^BF-SURVEY-\d{8}$/);
    const header = renderPrintDocHeader(BARNES_BRAND, { docTitle: "Survey Report" });
    expect(header).toContain("Barnes Fernández");
    expect(header).toContain("Surveying &amp; Civil Engineering");
    expect(header).not.toContain("Utility Mapping");
    const footer = renderPrintDocFooter(BARNES_BRAND);
    expect(footer).toContain("barnesfernandez.com");
    expect(footer).not.toContain("u-map.co.uk");
  });
});
