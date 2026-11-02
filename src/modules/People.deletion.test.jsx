/** @vitest-environment jsdom */
import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import People from "./People";
import { ToastProvider } from "../context/ToastContext";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
vi.mock("../context/AppContext", () => ({ useApp: () => ({ isPlatformOwner: true }) }));
vi.mock("../context/SupabaseAuthContext", () => ({ useSupabaseAuth: () => ({ user: null }) }));
vi.mock("../hooks/useD1WorkersProjectsSync", () => ({ useD1WorkersProjectsSync: () => ({}) }));
const workerKey = "mysafeops_workers_default";
const binKey = "mysafeops_recycle_bin_v1_default";
const worker = { id: "p1", name: "Alex Surveyor", site: "Client site" };
let host, root;
const rows = (key) => JSON.parse(localStorage.getItem(key) || "[]");
beforeEach(() => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  localStorage.clear();
  localStorage.setItem(workerKey, JSON.stringify([worker]));
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  localStorage.clear();
});
async function openConfirmation() {
  await act(async () => root.render(<StrictMode><MemoryRouter><ToastProvider><People /></ToastProvider></MemoryRouter></StrictMode>));
  const remove = [...host.querySelectorAll("button")].find(el => el.textContent.trim() === "Remove");
  expect(remove).toBeDefined();
  await act(async () => remove.click());
}
async function confirm(label = "Remove") {
  const button = [...host.querySelectorAll('[role="alertdialog"] button')].find(el => el.textContent === label);
  expect(button).toBeDefined();
  await act(async () => button.click());
}
function blockWrite(key) {
  const original = Storage.prototype.setItem;
  return vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (name, value) {
    if (name === key) throw new DOMException("Storage full", "QuotaExceededError");
    return original.call(this, name, value);
  });
}

it("shows one success notification after the worker is saved as deleted and archived once", async () => {
  await openConfirmation();
  await confirm();
  expect(rows(workerKey)[0].deletedAt).toBeTruthy();
  expect(rows(binKey)).toHaveLength(1);
  expect(rows(binKey)[0].payload).toEqual(worker);
  const toast = host.querySelectorAll(".app-toast--success");
  expect(toast).toHaveLength(1);
  expect(toast[0].textContent).toContain("Alex Surveyor");
  expect(toast[0].textContent).toContain("moved to Bin");
  expect(toast[0].textContent).toContain("7 days");
  expect(host.querySelector('[role="alertdialog"]')).toBeNull();
});

it("does not remove or announce success when cancelled", async () => {
  await openConfirmation();
  await confirm("Cancel");
  expect(rows(workerKey)).toEqual([worker]);
  expect(rows(binKey)).toEqual([]);
  expect(host.querySelector(".app-toast--success")).toBeNull();
});

it.each([workerKey, binKey])("keeps the worker and shows failure when %s cannot be saved, then supports retry", async (key) => {
  await openConfirmation();
  const blocked = blockWrite(key);
  await confirm();
  expect(rows(workerKey)).toEqual([worker]);
  expect(rows(binKey)).toEqual([]);
  expect(host.querySelector(".app-toast--success")).toBeNull();
  expect(host.querySelector(".app-toast--warn")?.textContent).toContain("could not be removed");
  expect(host.querySelector('[role="alertdialog"]')).not.toBeNull();
  blocked.mockRestore();
  await confirm();
  expect(rows(workerKey)[0].deletedAt).toBeTruthy();
  expect(rows(binKey)).toHaveLength(1);
  expect(host.querySelectorAll(".app-toast--success")).toHaveLength(1);
});
