import { describe, expect, it } from "vitest";
import { buildMsStepsFromRams } from "./fessMsWorkflow";

describe("method statement import", () => {
  it("preserves the full step title and description instead of inserting an ellipsis", () => {
    const title = "Confirm the site isolation boundary with the authorised supervisor before commencing work";
    const [step] = buildMsStepsFromRams({ surveyMethodStatement: `${title}. Record the confirmation in the log.` }, () => "step_1");
    expect(step.title).toBe(title);
    expect(step.description).toContain("Record the confirmation");
    expect(step.responsible).toBe(""); // Do not invent an authorisation or time estimate.
  });
});
