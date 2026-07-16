import { describe, it, expect } from "vitest";
import { escapeXml } from "./xmlEscape.js";

describe("xmlEscape", () => {
  it("escapes XML special characters", () => {
    expect(escapeXml("a")).toBe("a");
    expect(escapeXml("<tag>&\"")).toBe("&lt;tag&gt;&amp;&quot;");
    expect(escapeXml(null)).toBe("");
  });
});
