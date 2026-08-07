/** @vitest-environment jsdom */
import { describe, it, expect } from "vitest";
import { renderPermitDocumentHtml, buildPermitStatusDeepLink } from "./permitDocumentHtml";

describe("renderPermitDocumentHtml", () => {
  it("renders the Polish permit pack for an active Poland workspace", () => {
    localStorage.setItem("mysafeops_orgId", "pl-org");
    localStorage.setItem(
      "mysafeops_active_country_workspace_snapshot_pl-org",
      JSON.stringify({ id: "ws-pl", market_id: "pl", default_document_locale: "pl-PL", is_primary: false }),
    );
    const html = renderPermitDocumentHtml({
      id: "p-pl-1",
      type: "electrical",
      status: "pending_review",
      description: "Odłączenie rozdzielnicy",
      location: "Warszawa",
      issuedBy: "Anna",
      issuedTo: "Jan",
      checklist: {},
      extraFields: {},
    });
    expect(html).toContain('lang="pl-PL"');
    expect(html).toContain("Pozwolenie na odłączenie elektryczne");
    expect(html).toContain("Lista kontrolna przed rozpoczęciem pracy");
    expect(html).toContain("Kodeks pracy");
    expect(html).not.toContain("Legal references (UK)");
    localStorage.clear();
  });

  it("keeps UK en-GB pack and prefers profile legal references over country defaults", () => {
    localStorage.setItem("mysafeops_orgId", "uk-org");
    localStorage.setItem(
      "mysafeops_active_country_workspace_snapshot_uk-org",
      JSON.stringify({ id: "ws-uk", market_id: "uk", default_document_locale: "en-GB", is_primary: true }),
    );
    const withProfile = renderPermitDocumentHtml({
      id: "p-uk-1",
      type: "hot_work",
      status: "active",
      description: "Hot work on plant",
      location: "Plant room",
      issuedBy: "A",
      issuedTo: "B",
      checklist: {},
      extraFields: {},
      complianceProfile: {
        legalReferences: ["Dangerous Substances and Explosive Atmospheres Regulations 2002"],
      },
    });
    expect(withProfile).toContain('lang="en-GB"');
    expect(withProfile).toContain("Permit to work");
    expect(withProfile).toContain("Dangerous Substances and Explosive Atmospheres Regulations 2002");
    expect(withProfile).not.toContain("Kodeks pracy");

    const withoutProfile = renderPermitDocumentHtml({
      id: "p-uk-2",
      type: "general",
      status: "draft",
      description: "General works",
      location: "Site compound",
      issuedBy: "A",
      issuedTo: "B",
      checklist: {},
      extraFields: {},
    });
    expect(withoutProfile).toContain('lang="en-GB"');
    expect(withoutProfile).toContain("Legal and regulatory references (UK)");
    expect(withoutProfile).toContain("Construction (Design and Management) Regulations 2015");
    localStorage.clear();
  });

  it("includes closure and lessons learned for closed permits", () => {
    const html = renderPermitDocumentHtml({
      id: "p-closed-1",
      type: "general",
      status: "closed",
      closedAt: "2026-04-14T16:00:00.000Z",
      lessonsLearned: "Extend fire watch next time.",
      description: "Test",
      location: "Yard",
      issuedBy: "A",
      issuedTo: "B",
      startDateTime: "2026-04-14T08:00:00.000Z",
      endDateTime: "2026-04-14T15:00:00.000Z",
      checklist: {},
      extraFields: {},
    });
    expect(html).toContain("Permit closure");
    expect(html).toContain("Lessons learned");
    expect(html).toContain("Extend fire watch next time.");
    expect(html).toContain("CLOSED");
  });

  it("includes live status QR block with deep link", () => {
    const html = renderPermitDocumentHtml(
      {
        id: "p-live-1",
        type: "hot_work",
        status: "active",
        description: "Welding",
        location: "Bay 3",
        issuedBy: "A",
        issuedTo: "B",
        startDateTime: "2026-04-14T08:00:00.000Z",
        endDateTime: "2026-04-14T15:00:00.000Z",
        checklist: {},
        extraFields: {},
      },
      { origin: "https://mysafeops.com" }
    );
    expect(html).toContain("Scan for live status");
    expect(html).toContain("api.qrserver.com");
    expect(html).toContain(encodeURIComponent("https://mysafeops.com/app?view=permits&permitId=p-live-1"));
    expect(html).toContain("ptw-cover");
    expect(html).toContain("Checklist readiness");
  });
});

describe("buildPermitStatusDeepLink", () => {
  it("builds workspace permit URL", () => {
    expect(buildPermitStatusDeepLink("abc", "https://mysafeops.com")).toBe(
      "https://mysafeops.com/app?view=permits&permitId=abc"
    );
  });
});

describe("contractor acknowledgements on PDF", () => {
  it("embeds read/sign acknowledgements with signature images", () => {
    const html = renderPermitDocumentHtml({
      id: "p-ack-1",
      type: "general",
      status: "active",
      description: "Test",
      location: "Yard",
      issuedBy: "A",
      issuedTo: "B",
      startDateTime: "2026-04-14T08:00:00.000Z",
      endDateTime: "2026-04-14T15:00:00.000Z",
      checklist: {},
      extraFields: {},
      acknowledgements: [
        {
          at: "2026-04-14T09:00:00.000Z",
          by: "Sam Contractor",
          note: "Read/Sign link confirmation",
          signatureImageDataUrl: "data:image/png;base64,aaa",
        },
      ],
    });
    expect(html).toContain("Contractor acknowledgements");
    expect(html).toContain("Sam Contractor");
    expect(html).toContain("data:image/png;base64,aaa");
  });
});

describe("excavation dig guidance on PDF", () => {
  it("embeds PAS 128 safe dig section for excavation permits", () => {
    const html = renderPermitDocumentHtml({
      id: "p-dig-1",
      type: "excavation",
      status: "active",
      description: "Trial trench",
      location: "Grid B4",
      issuedBy: "A",
      issuedTo: "B",
      startDateTime: "2026-04-14T08:00:00.000Z",
      endDateTime: "2026-04-14T15:00:00.000Z",
      checklist: {},
      extraFields: {
        pas128QualityLevel: "QL-B",
        pas128SurveyType: "B1",
        surveyDrawingRef: "PAS128-B1-Rev2",
      },
    });
    expect(html).toContain("Safe dig");
    expect(html).toContain("PAS 128");
    expect(html).toContain("B1");
    expect(html).toContain("PAS128-B1-Rev2");
  });
});

describe("hot work guidance on PDF", () => {
  it("embeds hot work infographics for hot_work permits", () => {
    const html = renderPermitDocumentHtml({
      id: "p-hw-1",
      type: "hot_work",
      status: "active",
      description: "Grinding",
      location: "Workshop",
      issuedBy: "A",
      issuedTo: "B",
      startDateTime: "2026-04-14T08:00:00.000Z",
      endDateTime: "2026-04-14T15:00:00.000Z",
      checklist: {},
      extraFields: {
        fireWatcher: "Sam",
        fireWatchDurationMins: 60,
        combustiblesCleared10m: "yes",
        extinguishersInPlace: "yes",
        fireBlanketInPlace: "yes",
      },
    });
    expect(html).toContain("Hot work guidance");
    expect(html).toContain("Fire watch");
    expect(html).toContain("<svg");
  });
});
