import { describe, expect, it } from "vitest";
import { AI_PROMPT_IDS, buildAiRamsSystemPrompt, resolveAiSystemPrompt } from "./aiPromptTemplates.mjs";

describe("aiPromptTemplates", () => {
  it("pins known prompt ids", () => {
    expect(AI_PROMPT_IDS.has("rams_draft")).toBe(true);
    expect(resolveAiSystemPrompt("toolbox_talk")).toMatch(/toolbox talks/);
    expect(resolveAiSystemPrompt("survey_prose")).toMatch(/EXECUTIVE SUMMARY/);
    expect(resolveAiSystemPrompt("photo_hazard")).toMatch(/construction safety observer/);
    expect(resolveAiSystemPrompt("nope")).toBeNull();
  });

  it("keeps Polish AI drafts in the Polish jurisdiction", () => {
    const prompt = buildAiRamsSystemPrompt("pl");
    expect(prompt).toMatch(/Poland/);
    expect(prompt).toMatch(/IBWR/);
    expect(resolveAiSystemPrompt("rams_draft", "pl")).toBe(prompt);
  });
});
