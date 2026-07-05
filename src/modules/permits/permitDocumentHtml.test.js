import { describe, it, expect } from "vitest";
import { renderPermitDocumentHtml, buildPermitStatusDeepLink } from "./permitDocumentHtml";

describe("renderPermitDocumentHtml", () => {
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
  });
});

describe("buildPermitStatusDeepLink", () => {
  it("builds workspace permit URL", () => {
    expect(buildPermitStatusDeepLink("abc", "https://mysafeops.com")).toBe(
      "https://mysafeops.com/app?view=permits&permitId=abc"
    );
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
