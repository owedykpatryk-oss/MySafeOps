/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import GeoPhotoImg from "./GeoPhotoImg";
import { resolveGeoPhotoPdfDataUrl, resolveGeoPhotoCachedDataUrl } from "../../utils/geoPhotoMedia";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
vi.mock("../../utils/geoPhotoMedia", () => ({
  geoPhotoDisplayUrl: (photo) => photo.photoPublicUrl || "",
  resolveGeoPhotoCachedDataUrl: vi.fn(async () => null),
  resolveGeoPhotoPdfDataUrl: vi.fn(),
}));
let root;
afterEach(() => { act(() => root?.unmount()); vi.restoreAllMocks(); vi.clearAllMocks(); });

it("ignores a previous photo's late authenticated response", async () => {
  let finish;
  resolveGeoPhotoPdfDataUrl.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  const container = document.createElement("div");
  root = createRoot(container);
  await act(async () => root.render(<GeoPhotoImg photo={{ id: "a", photoStorageKey: "a", photoPublicUrl: "https://example.com/a" }} />));
  await act(async () => container.querySelector("img").dispatchEvent(new Event("error")));
  await act(async () => root.render(<GeoPhotoImg photo={{ id: "b", photoPublicUrl: "https://example.com/b" }} />));
  await act(async () => finish("data:image/jpeg;base64,b2xk"));
  expect(container.querySelector("img").getAttribute("src")).toBe("https://example.com/b");
});

it("uses the offline image even when a cloud URL exists", async () => {
  resolveGeoPhotoCachedDataUrl.mockResolvedValueOnce("data:image/jpeg;base64,Y2FjaGVk");
  const container = document.createElement("div");
  root = createRoot(container);
  await act(async () => root.render(<GeoPhotoImg photo={{ id: "a", photoStorageKey: "a", photoPublicUrl: "https://example.com/a" }} />));
  expect(container.querySelector("img").getAttribute("src")).toBe("data:image/jpeg;base64,Y2FjaGVk");
  expect(resolveGeoPhotoPdfDataUrl).not.toHaveBeenCalled();
  act(() => root.unmount());
  root = null;
});
