import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import PermitDigGuidancePanel from "./PermitDigGuidancePanel";

describe("PermitDigGuidancePanel", () => {
  it("renders PAS 128 guidance for UK excavation", () => {
    const html = renderToStaticMarkup(
      createElement(PermitDigGuidancePanel, { permitType: "excavation", marketId: "uk" })
    );
    expect(html).toMatch(/PAS 128/);
    expect(html).toMatch(/HSG47/);
  });

  it("returns null off UK so Poland and Australia do not see CAT/PAS 128 fields", () => {
    expect(
      renderToStaticMarkup(createElement(PermitDigGuidancePanel, { permitType: "excavation", marketId: "pl" }))
    ).toBe("");
    expect(
      renderToStaticMarkup(
        createElement(PermitDigGuidancePanel, { permitType: "ground_disturbance", marketId: "au" })
      )
    ).toBe("");
  });
});
