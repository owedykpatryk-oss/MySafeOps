/** @vitest-environment jsdom */
import { afterEach, expect, it, vi } from "vitest";
import { compressImageFile } from "./geoPhotoUtils";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it("rejects an iPhone photo immediately when canvas decoding fails and releases the URL", async () => {
  const revoke = vi.fn();
  vi.stubGlobal("URL", { createObjectURL: () => "blob:test-photo", revokeObjectURL: revoke });
  vi.stubGlobal("createImageBitmap", undefined);
  vi.stubGlobal("Image", class {
    naturalWidth = 2;
    naturalHeight = 2;
    set src(_url) { queueMicrotask(() => this.onload()); }
  });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: () => { throw new Error("Canvas unavailable"); } });
  await expect(compressImageFile(new File(["bad"], "IMG_100.HEIC"))).rejects.toThrow(/HEIC.*converted/);
  expect(revoke).toHaveBeenCalledWith("blob:test-photo");
});

it("releases the URL and reports a failed image read", async () => {
  const revoke = vi.fn();
  vi.stubGlobal("URL", { createObjectURL: () => "blob:test-photo", revokeObjectURL: revoke });
  vi.stubGlobal("createImageBitmap", undefined);
  vi.stubGlobal("Image", class { set src(_url) { queueMicrotask(() => this.onerror()); } });
  await expect(compressImageFile(new File(["bad"], "broken.jpg"))).rejects.toThrow("Could not read photo");
  expect(revoke).toHaveBeenCalledOnce();
});
