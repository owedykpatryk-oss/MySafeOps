import { describe, expect, it } from "vitest";
import { buildOpenStreetMapLink, buildStaticMapUrl } from "./staticMapUrl.js";

describe("staticMapUrl", () => {
  it("returns svg data url for valid coords", () => {
    const url = buildStaticMapUrl(52.36, -1.21, { width: 120, height: 80 });
    expect(url.startsWith("data:image/svg+xml")).toBe(true);
    expect(url).toContain("52.36000");
  });

  it("returns empty for invalid coords", () => {
    expect(buildStaticMapUrl(null, -1.21)).toBe("");
  });

  it("builds OSM browser link", () => {
    expect(buildOpenStreetMapLink(52.36, -1.21)).toContain("openstreetmap.org");
  });
});
