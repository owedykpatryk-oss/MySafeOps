import { describe, expect, it, vi } from "vitest";
import { geoPhotoDisplayUrl, uploadGeoPhotoToR2 } from "./geoPhotoMedia.js";

vi.mock("../lib/r2Storage.js", () => ({
  isR2StorageConfigured: vi.fn(() => true),
  uploadFileToR2Storage: vi.fn(async () => ({
    key: "geo-photos/test/photo.jpg",
    size: 3,
    publicUrl: "https://cdn.example/photo.jpg",
  })),
}));

vi.mock("./orgStorage.js", () => ({
  getOrgId: vi.fn(() => "org_1"),
}));

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

  it("uploads data URL to R2 without fetch", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await uploadGeoPhotoToR2("data:image/jpeg;base64,YWJj", {
      projectId: "p1",
      photoId: "ph_1",
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
    expect(result).toEqual({
      photoStorageKey: "geo-photos/test/photo.jpg",
      photoPublicUrl: "https://cdn.example/photo.jpg",
    });
  });
});
