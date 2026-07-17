/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  resolveSurveyFixTarget,
  resolveGateFixTarget,
  scrollToSurveyAnchor,
  SURVEY_QUALITY_FIX,
} from "./surveyFixNav";

describe("surveyFixNav", () => {
  it("maps quality labels to tabs and anchors", () => {
    expect(resolveSurveyFixTarget({ label: "Recommendations" })).toEqual({
      tab: "findings",
      anchor: "recommendations",
    });
    expect(resolveSurveyFixTarget({ label: "Document control" })).toEqual({
      tab: "details",
      anchor: "document-control",
    });
    expect(SURVEY_QUALITY_FIX["QA checklist"].tab).toBe("professional");
  });

  it("maps gate messages to the right place", () => {
    expect(resolveGateFixTarget("At least one site photo").tab).toBe("photos");
    expect(resolveGateFixTarget("Equipment calibration records").anchor).toBe("calibration");
    expect(resolveGateFixTarget("Utility schedule (utilities table)").tab).toBe("findings");
    expect(resolveGateFixTarget("Sign-off (approved by or surveyor signed date)").tab).toBe("details");
  });

  it("falls back to a valid tab", () => {
    expect(resolveSurveyFixTarget({ tab: "nope" }).tab).toBe("details");
  });

  describe("scrollToSurveyAnchor", () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div data-survey-anchor="utilities">
          <input id="u1" />
        </div>
      `;
    });
    afterEach(() => {
      document.body.innerHTML = "";
    });

    it("scrolls, highlights and focuses", () => {
      const el = document.querySelector("[data-survey-anchor=\"utilities\"]");
      el.scrollIntoView = vi.fn();
      const ok = scrollToSurveyAnchor("utilities");
      expect(ok).toBe(true);
      expect(el.classList.contains("app-survey-fix-target")).toBe(true);
      expect(el.scrollIntoView).toHaveBeenCalled();
      expect(document.activeElement?.id).toBe("u1");
    });
  });
});
