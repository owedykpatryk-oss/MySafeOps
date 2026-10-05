import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PermitCard } from "./PermitSystem.jsx";

function renderCard(permit) {
  return renderToStaticMarkup(
    createElement(PermitCard, {
      permit,
      onEdit: () => {},
      onClose: () => {},
      onDelete: () => {},
      onPreview: () => {},
      onPrint: () => {},
    })
  );
}

describe("PermitCard list render", () => {
  it("renders a draft permit card without a temporal dead zone", () => {
    const html = renderCard({
      id: "ptw_draft_1",
      type: "hot_work",
      status: "draft",
      location: "Roof plant",
      description: "Weld brackets",
      checklist: {},
      startDateTime: "2026-04-09T08:00:00.000Z",
      endDateTime: "2026-04-09T16:00:00.000Z",
    });
    expect(html).toContain("Hot work permit");
    expect(html).toContain("Roof plant");
    expect(html).toContain("Export PDF");
    expect(html).not.toContain("Briefing pending");
  });

  it("shows briefing pending on an active permit past the confirmation window", () => {
    const started = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const html = renderCard({
      id: "ptw_active_1",
      type: "hot_work",
      status: "active",
      location: "Roof plant",
      briefingConfirmedAt: "",
      linkedRamsId: "rams_1",
      checklist: {},
      startDateTime: started,
      endDateTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    });
    expect(html).toContain("Briefing pending");
    expect(html).toContain("Export PDF");
    expect(html).not.toContain("RAMS missing");
  });
});
