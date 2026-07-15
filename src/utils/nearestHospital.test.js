import { describe, expect, it } from "vitest";
import { buildHospitalQuery } from "./hospitalOverpassQuery.js";

describe("hospitalOverpassQuery", () => {
  it("queries nwr with center tags so area hospitals are included", () => {
    const q = buildHospitalQuery(52.36, -1.21, 25000);
    expect(q).toContain("nwr(around:25000,52.36,-1.21)");
    expect(q).toContain("out center tags");
    expect(q).not.toMatch(/^\s*node\(around/m);
  });
});
