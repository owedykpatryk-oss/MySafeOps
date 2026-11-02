/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it } from "vitest";
import GprEquipmentProfileImages from "./GprEquipmentProfileImages";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root;
afterEach(() => act(() => root?.unmount()));

it("keeps a working product view and replaces failed views with the equipment fallback", () => {
  const container = document.createElement("div");
  root = createRoot(container);
  const preset = {
    key: "proceq_gp8100",
    manufacturer: "Proceq",
    model: "GP8100",
    imageUrls: ["/assets/front.png", "/assets/side.png"],
  };
  act(() => root.render(<GprEquipmentProfileImages preset={preset} />));
  expect(container.querySelectorAll("img")).toHaveLength(2);

  act(() => container.querySelector('img[src="/assets/front.png"]').dispatchEvent(new Event("error")));
  expect(container.querySelectorAll("img")).toHaveLength(1);
  expect(container.querySelector("img").getAttribute("alt")).toContain("view 2");

  act(() => container.querySelector("img").dispatchEvent(new Event("error")));
  expect(container.querySelectorAll("img")).toHaveLength(0);
  expect(container.querySelector(".app-gpr-equipment-profile__fallback")?.textContent).toContain("GP8100");
});
