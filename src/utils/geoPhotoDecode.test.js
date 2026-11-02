/** @vitest-environment jsdom */
import { afterEach, expect, it, vi } from "vitest";
import { compressImageFile } from "./geoPhotoUtils";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it("bounds both dimensions of a portrait panorama before allocating an iPhone canvas", async () => {
  vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width: 1000, height: 24000, close: vi.fn() }));
  let canvas;
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function () { canvas = this; return { drawImage: vi.fn() }; });
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/jpeg;base64,test");
  await compressImageFile(new File(["pixels"], "panorama.jpg"));
  expect(canvas.width).toBeLessThanOrEqual(1280);
  expect(canvas.height).toBeLessThanOrEqual(1280);
});
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
