import { describe, expect, it } from "vitest";
import { formatCustomFieldsLine, customFieldsForExport, CUSTOM_FIELD_PRESETS } from "./orgCustomFields.js";

describe("orgCustomFields", () => {
  it("formats export line from fields with values", () => {
    const line = formatCustomFieldsLine([
      { label: "Contract", value: "FW-001" },
      { label: "Empty", value: "" },
      { label: "PC", value: "Acme Ltd" },
    ]);
    expect(line).toContain("Contract: FW-001");
    expect(line).not.toContain("Empty");
  });

  it("presets are defined", () => {
    expect(CUSTOM_FIELD_PRESETS.length).toBeGreaterThanOrEqual(4);
  });

  it("filters empty labels", () => {
    expect(customFieldsForExport([{ label: "", value: "x" }]).length).toBe(0);
  });
});
