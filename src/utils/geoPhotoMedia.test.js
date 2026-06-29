import { describe, expect, it } from "vitest";
import { geoPhotoDisplayUrl } from "./geoPhotoMedia.js";

describe("geoPhotoMedia", () => {
  it("prefers embedded data URL over public URL", () => {
    expect(
      geoPhotoDisplayUrl({
        photoDataUrl: "data:image/jpeg;base64,abc",
        photoPublicUrl: "https://cdn.example/a.jpg",
      })
    ).toBe("data:image/jpeg;base64,abc");
  });

  it("falls back to public URL when no data URL", () => {
    expect(geoPhotoDisplayUrl({ photoPublicUrl: "https://cdn.example/b.jpg" })).toBe("https://cdn.example/b.jpg");
  });
});
