import { describe, expect, it, vi } from "vitest";
import {
  geoPhotoDisplayUrl,
  geoPhotoHasRenderableMedia,
  preserveGeoPhotoMedia,
  uploadGeoPhotoToR2,
} from "./geoPhotoMedia.js";

vi.mock("../lib/r2Storage.js", () => ({
  isR2StorageConfigured: vi.fn(() => true),
  isUsableR2PublicUrl: vi.fn((url) => Boolean(url) && !String(url).includes("workers.dev/geo-photos")),
  pickR2ViewUrl: vi.fn((meta) => meta?.signedUrl || meta?.publicUrl || null),
  fetchR2ObjectBlob: vi.fn(async () => new Blob(["x"], { type: "image/jpeg" })),
  uploadFileToR2Storage: vi.fn(async () => ({
    key: "geo-photos/test/photo.jpg",
    size: 3,
    publicUrl: "https://cdn.example/photo.jpg",
    signedUrl: "https://worker.example/signed?k=1",
    signedExpiresAt: Math.floor(Date.now() / 1000) + 3600,
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

  it("treats storage-key-only photos as renderable", () => {
    expect(geoPhotoHasRenderableMedia({ photoStorageKey: "geo-photos/org_x/a.jpg" })).toBe(true);
    expect(geoPhotoHasRenderableMedia({})).toBe(false);
  });

  it("restores an embedded image the synced row lost", () => {
    const local = [{ id: "a", photoDataUrl: "data:image/jpeg;base64,abc" }];
    const incoming = [{ id: "a", notes: "from D1", photoDataUrl: "" }];
    expect(preserveGeoPhotoMedia(local, incoming)).toEqual([
      { id: "a", notes: "from D1", photoDataUrl: "data:image/jpeg;base64,abc" },
    ]);
  });

  it("leaves rows alone when R2 holds the image or the row already has one", () => {
    const local = [
      { id: "a", photoDataUrl: "data:image/jpeg;base64,old" },
      { id: "b", photoDataUrl: "data:image/jpeg;base64,old" },
    ];
    const incoming = [
      { id: "a", photoStorageKey: "geo-photos/org_x/a.jpg" },
      { id: "b", photoDataUrl: "data:image/jpeg;base64,new" },
      { id: "c" },
    ];
    expect(preserveGeoPhotoMedia(local, incoming)).toEqual(incoming);
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
      photoSignedUrl: "https://worker.example/signed?k=1",
      photoSignedExpiresAt: expect.any(Number),
    });
  });
});
