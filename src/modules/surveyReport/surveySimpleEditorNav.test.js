import { describe, it, expect } from "vitest";
import {
  SURVEY_SIMPLE_STEPS,
  simpleStepForTab,
  adjacentSimpleStep,
  tabsForSimpleStep,
  firstTabOfSimpleStep,
} from "./surveySimpleEditorNav";

describe("surveySimpleEditorNav", () => {
  it("groups tabs into four steps with plain English labels", () => {
    expect(SURVEY_SIMPLE_STEPS).toHaveLength(4);
    expect(SURVEY_SIMPLE_STEPS.map((s) => s.id)).toEqual(["mobilise", "site", "findings", "issue"]);
    expect(SURVEY_SIMPLE_STEPS.map((s) => s.label)).toEqual(["Start", "On site", "Findings", "Print"]);
  });

  it("resolves step from tab id", () => {
    expect(simpleStepForTab("weather").id).toBe("site");
    expect(simpleStepForTab("preview").id).toBe("issue");
  });

  it("returns adjacent steps", () => {
    expect(adjacentSimpleStep("mobilise", "next")?.id).toBe("site");
    expect(adjacentSimpleStep("issue", "next")).toBeNull();
    expect(adjacentSimpleStep("findings", "prev")?.id).toBe("site");
  });

  it("lists tabs per step", () => {
    expect(tabsForSimpleStep("mobilise")).toEqual(["details", "scope", "professional"]);
    expect(firstTabOfSimpleStep("issue")).toBe("preview");
  });
});
