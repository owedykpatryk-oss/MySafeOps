import { describe, it, expect } from "vitest";
import { renderPermitDocumentHtml } from "./permitDocumentHtml";

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
});
