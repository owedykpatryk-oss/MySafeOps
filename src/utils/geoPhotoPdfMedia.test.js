/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveGeoPhotoPdfDataUrl } from "./geoPhotoMedia";
const mocks = vi.hoisted(() => ({ get: vi.fn(), fetch: vi.fn(), cached: vi.fn(), write: vi.fn() }));
vi.mock("./geoPhotoOfflineStore", () => ({ readGeoPhotoOffline: mocks.cached, writeGeoPhotoOffline: mocks.write }));
vi.mock("../lib/r2Storage", () => ({
  fetchR2ObjectBlob: mocks.get, isR2StorageConfigured: () => true,
  pickR2ViewUrl: (meta) => meta.publicUrl || "", isUsableR2PublicUrl: () => true,
  uploadFileToR2Storage: vi.fn(),
}));
beforeEach(() => { vi.clearAllMocks(); mocks.cached.mockResolvedValue(null); vi.stubGlobal("fetch", mocks.fetch); });

describe("Geo-photo PDF image bytes", () => {
  it("keeps offline embedded images without a network request", async () => {
    expect(await resolveGeoPhotoPdfDataUrl({ photoDataUrl: "data:image/jpeg;base64,YWJj" })).toBe("data:image/jpeg;base64,YWJj");
    expect(mocks.get).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("downloads storage-key-only images with authenticated storage access", async () => {
    mocks.get.mockResolvedValue(new Blob(["abc"], { type: "image/jpeg" }));
    expect(await resolveGeoPhotoPdfDataUrl({ photoStorageKey: "geo-photos/site.jpg" })).toBe("data:image/jpeg;base64,YWJj");
    expect(mocks.get).toHaveBeenCalledWith("geo-photos/site.jpg");
  });
  it("embeds cached image bytes in a PDF without contacting storage", async () => {
    mocks.cached.mockResolvedValue({ bytes: new Uint8Array([97, 98, 99]).buffer, type: "image/jpeg" });
    expect(await resolveGeoPhotoPdfDataUrl({ photoStorageKey: "offline/site.jpg" })).toBe("data:image/jpeg;base64,YWJj");
    expect(mocks.get).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("falls back to a usable public URL and handles unavailable images", async () => {
    mocks.get.mockRejectedValue(new Error("Offline"));
    mocks.fetch.mockResolvedValue({ ok: true, blob: async () => new Blob(["abc"], { type: "image/png" }) });
    expect(await resolveGeoPhotoPdfDataUrl({ photoStorageKey: "x", photoPublicUrl: "https://cdn.example/site.png" })).toBe("data:image/png;base64,YWJj");
    mocks.fetch.mockResolvedValue({ ok: false });
    expect(await resolveGeoPhotoPdfDataUrl({ photoPublicUrl: "https://cdn.example/missing.png" })).toBeNull();
  });
});
