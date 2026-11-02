/** @vitest-environment jsdom */
import { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import COSHHRegister from "./COSHHRegister";
import InspectionTracker from "./InspectionTracker";
import SnagRegister from "./SnagRegister";
import DailyBriefing from "./DailyBriefing";
import IncidentNearMiss from "./IncidentNearMiss";
import { overlayDraftKey } from "../hooks/useOverlayFormDraft";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
vi.mock("../context/AppContext", () => ({ useApp: () => ({ caps: { deleteRecords: true } }) }));
vi.mock("../components/PageHero", () => ({ default: ({ right }) => <>{right}</> }));
vi.mock("../components/RegisterModuleShell", () => ({ default: ({ children }) => <>{children}</> }));
vi.mock("../hooks/useD1WorkersProjectsSync", () => ({ useD1WorkersProjectsSync: () => ({}) }));
vi.mock("../hooks/useD1OrgArraySync", () => ({ useD1OrgArraySync: ({ value, save, storageKey }) => {
  useEffect(() => { save(storageKey, value); }, [value, save, storageKey]); return {};
} }));
let root, host;
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  localStorage.setItem("mysafeops_projects_default", JSON.stringify([{ id: "p1", name: "North depot" }]));
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});

it("keeps the quick incident fields and draft after a failed save", async () => {
  await act(async () => root.render(<IncidentNearMiss />));
  const input = host.querySelector('input[placeholder="Location / area"]');
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, "North depot");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const button = [...host.querySelectorAll("button")].find(b => b.textContent.trim() === "Save quick report");
  const original = Storage.prototype.setItem;
  const block = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (key, value) {
    if (key === "mysafeops_incidents_default") throw new DOMException("Full", "QuotaExceededError");
    return original.call(this, key, value);
  });
  await act(async () => button.click());
  expect(input.value).toBe("North depot");
  expect(JSON.parse(sessionStorage.getItem(overlayDraftKey("incident-quick", "capture"))).location).toBe("North depot");
  block.mockRestore();
  await act(async () => button.click());
  expect(input.value).toBe("");
  expect(JSON.parse(localStorage.getItem("mysafeops_incidents_default"))).toHaveLength(1);
});

it("archives COSHH substances, honours cancellation, and hides tombstones from the register", async () => {
  const row = { id: "qa-coshh", name: "Test substance", hazardTypes: [], ppeRequired: [], riskLevel: "low" };
  localStorage.setItem("coshh_items_default", JSON.stringify([row]));
  await act(async () => root.render(<COSHHRegister />));
  const remove = () => [...host.querySelectorAll("button")].find(b => b.textContent.trim() === "×");
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  await act(async () => remove().click());
  expect(JSON.parse(localStorage.getItem("coshh_items_default"))).toEqual([row]);
  confirm.mockReturnValue(true);
  await act(async () => remove().click());
  expect(JSON.parse(localStorage.getItem("coshh_items_default"))[0].deletedAt).toBeTruthy();
  expect(JSON.parse(localStorage.getItem("mysafeops_recycle_bin_v1_default"))[0].payload).toEqual(row);
  expect(host.textContent).not.toContain("Test substance");
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); localStorage.clear(); sessionStorage.clear(); });
const cases = [
  [COSHHRegister, "coshh_items", "coshh", "+ Add record", { id: "qa-1", name: "Test substance" }],
  [InspectionTracker, "inspection_records", "inspection", "+ Add record", { id: "qa-1", name: "Test equipment" }],
  [SnagRegister, "snags", "snag", "+ Add record", { id: "qa-1", title: "Test defect", projectId: "p1" }],
  [DailyBriefing, "daily_briefings", "briefing", "+ New briefing", { location: "Test site", conductedBy: "Alex", attendees: [{ id: "w1", name: "Alex", present: true }] }],
];
it.each(cases)("%s keeps the editor and draft on storage failure, then saves exactly once on retry", async (Module, key, draftModule, addLabel, data) => {
  const draftKey = overlayDraftKey(draftModule, "new");
  sessionStorage.setItem(draftKey, JSON.stringify(data));
  await act(async () => root.render(<Module />));
  const add = [...host.querySelectorAll("button")].find(b => b.textContent.trim() === addLabel);
  expect(add, addLabel).toBeDefined(); await act(async () => add.click());
  const panel = () => host.querySelector(".app-module-overlay__panel");
  const saveButton = () => [...panel().querySelectorAll("button")].find(b => /^Save/.test(b.textContent.trim()));
  expect(saveButton()).toBeDefined(); expect(saveButton().disabled).toBe(false);
  const original = Storage.prototype.setItem;
  const block = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (name, value) {
    if (name === `${key}_default`) throw new DOMException("Full", "QuotaExceededError");
    return original.call(this, name, value);
  });
  await act(async () => saveButton().click());
  expect(panel()).not.toBeNull();
  expect(sessionStorage.getItem(draftKey)).not.toBeNull();
  expect(JSON.parse(localStorage.getItem(`${key}_default`) || "[]")).toEqual([]);
  block.mockRestore();
  await act(async () => saveButton().click());
  expect(panel()).toBeNull();
  expect(JSON.parse(localStorage.getItem(`${key}_default`))).toHaveLength(1);
  expect(sessionStorage.getItem(draftKey)).toBeNull();
});
