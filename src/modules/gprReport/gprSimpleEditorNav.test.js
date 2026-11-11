import { describe, expect, it } from "vitest";
import {
  GPR_SIMPLE_STEPS,
  adjacentGprSimpleStep,
  firstTabOfGprSimpleStep,
  gprSimpleStepForTab,
} from "./gprSimpleEditorNav.js";

describe("gprSimpleEditorNav", () => {
  it("maps every editor tab into a simple step", () => {
    const tabs = GPR_SIMPLE_STEPS.flatMap((s) => s.tabs);
    expect(tabs).toEqual(["setup", "equipment", "ground", "findings", "narrative", "qa"]);
    expect(gprSimpleStepForTab("ground").id).toBe("kit");
    expect(gprSimpleStepForTab("qa").id).toBe("issue");
  });

  it("moves between simple steps", () => {
    expect(firstTabOfGprSimpleStep("kit")).toBe("equipment");
    expect(adjacentGprSimpleStep("start", "next")?.id).toBe("kit");
    expect(adjacentGprSimpleStep("issue", "next")).toBeNull();
    expect(adjacentGprSimpleStep("findings", "prev")?.id).toBe("kit");
  });
});
