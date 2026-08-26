import { describe, expect, it } from "vitest";
import { buildAiRamsSystemPrompt } from "./AIRamsGenerator";

describe("buildAiRamsSystemPrompt", () => {
  it("keeps Polish AI drafts in the Polish jurisdiction", () => {
    const prompt = buildAiRamsSystemPrompt("pl");
    expect(prompt).toMatch(/Poland/);
    expect(prompt).toMatch(/IBWR/);
    expect(prompt).toMatch(/Polish BHP/);
    expect(prompt).toMatch(/Never cite UK HSE/);
  });

  it("uses distinct German, Austrian and Swiss legal contexts", () => {
    expect(buildAiRamsSystemPrompt("de")).toMatch(/ArbSchG/);
    expect(buildAiRamsSystemPrompt("at")).toMatch(/ASchG/);
    expect(buildAiRamsSystemPrompt("ch")).toMatch(/BauAV/);
  });
});
