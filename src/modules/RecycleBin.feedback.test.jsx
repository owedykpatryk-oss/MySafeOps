/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import RecycleBin from "./RecycleBin";
import { pushRecycleBinItem, listRecycleBinEntries } from "../utils/recycleBin";
import { saveOrgScoped, loadOrgScoped } from "../utils/orgStorage";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
vi.mock("../components/PageHero", () => ({ default: () => null }));
let root, host;
beforeEach(() => {
  localStorage.clear();
  saveOrgScoped("coshh_items", [{ id: "r1", deletedAt: new Date().toISOString() }]);
  pushRecycleBinItem({ sourceKey: "coshh_items", moduleLabel: "COSHH", itemLabel: "Test substance", payload: { id: "r1", name: "Test substance" } });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); localStorage.clear(); });
async function click(label) {
  const button = [...host.querySelectorAll("button")].find(b => b.textContent.trim() === label);
  expect(button).toBeDefined(); await act(async () => button.click());
}
it("confirms a successful restore and tells the user which module contains it", async () => {
  await act(async () => root.render(<RecycleBin />)); await click("Restore");
  expect(host.querySelector('[role="status"]')?.textContent).toContain("Restored “Test substance”");
  expect(host.querySelector('[role="status"]')?.textContent).toContain("COSHH");
  expect(loadOrgScoped("coshh_items", [])[0].deletedAt).toBeUndefined();
  expect(listRecycleBinEntries()).toEqual([]);
});
it("keeps a failed restore in the Bin and shows inline failure", async () => {
  await act(async () => root.render(<RecycleBin />));
  const original = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (key, value) {
    if (key === "coshh_items_default") throw new DOMException("Full", "QuotaExceededError");
    return original.call(this, key, value);
  });
  await click("Restore");
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("could not be saved");
  expect(listRecycleBinEntries()).toHaveLength(1);
  expect(host.querySelector('[role="status"]')).toBeNull();
});
