/** @vitest-environment jsdom */
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { softDeleteToRecycleBin, listRecycleBinEntries } from "./recycleBin";
import { loadOrgScoped, saveOrgScoped } from "./orgStorage";
import { OPS_TOAST_EVENT_NAME } from "./clientOpsMonitor";

const record = { id: "a", name: "Site record", details: "keep evidence" };
let notifications;
const receive = event => notifications.push(event.detail);
beforeEach(() => {
  localStorage.clear(); notifications = [];
  saveOrgScoped("daily_briefings", [record, { id: "b", name: "Other record" }]);
  vi.spyOn(window, "confirm").mockReturnValue(true);
  window.addEventListener(OPS_TOAST_EVENT_NAME, receive);
});
afterEach(() => { window.removeEventListener(OPS_TOAST_EVENT_NAME, receive); vi.restoreAllMocks(); localStorage.clear(); });
const remove = () => softDeleteToRecycleBin({ sourceKey: "daily_briefings", payload: record, itemLabel: record.name });
it("persists the deletion before announcing success and archives the complete record once", () => {
  expect(remove()).toBe(true);
  expect(loadOrgScoped("daily_briefings", []).find(r => r.id === "a").deletedAt).toBeTruthy();
  expect(loadOrgScoped("daily_briefings", []).find(r => r.id === "b").name).toBe("Other record");
  expect(listRecycleBinEntries().map(r => r.payload)).toEqual([record]);
  expect(notifications.filter(n => n.type === "success")).toHaveLength(1);
  remove();
  expect(listRecycleBinEntries()).toHaveLength(1);
});
it.each(["daily_briefings_default", "mysafeops_recycle_bin_v1_default"])("keeps the record when %s cannot be written, then allows retry", key => {
  const original = Storage.prototype.setItem;
  const blocked = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (name, value) {
    if (name === key) throw new DOMException("Full", "QuotaExceededError");
    return original.call(this, name, value);
  });
  expect(remove()).toBe(false);
  expect(loadOrgScoped("daily_briefings", [])[0]).toEqual(record);
  expect(listRecycleBinEntries()).toEqual([]);
  expect(notifications.some(n => n.type === "success")).toBe(false);
  expect(notifications.some(n => n.type === "warn")).toBe(true);
  blocked.mockRestore();
  expect(remove()).toBe(true);
});
it("does not change data or show success after cancellation", () => {
  window.confirm.mockReturnValue(false);
  expect(remove()).toBe(false);
  expect(listRecycleBinEntries()).toEqual([]);
  expect(loadOrgScoped("daily_briefings", [])[0]).toEqual(record);
  expect(notifications).toEqual([]);
});

it("keeps the recovery copy when both deletion and rollback writes fail", () => {
  const original = Storage.prototype.setItem;
  let binWrites = 0;
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (key, value) {
    if (key === "daily_briefings_default" || (key === "mysafeops_recycle_bin_v1_default" && ++binWrites > 1)) {
      throw new DOMException("Full", "QuotaExceededError");
    }
    return original.call(this, key, value);
  });
  expect(remove()).toBe(false);
  expect(loadOrgScoped("daily_briefings", [])[0]).toEqual(record);
  expect(listRecycleBinEntries()[0].payload).toEqual(record);
  expect(notifications.some(n => n.type === "success")).toBe(false);
});

it("only deletes the record in the active organisation and country", () => {
  localStorage.setItem("mysafeops_orgId", "org-b");
  localStorage.setItem("mysafeops_billing_plan_org-b", "team");
  localStorage.setItem("mysafeops_subscription_status_org-b", "active");
  localStorage.setItem("mysafeops_active_country_workspace_org-b", "au-1");
  localStorage.setItem("mysafeops_active_country_workspace_snapshot_org-b", JSON.stringify({ id: "au-1", is_primary: false, market_id: "au" }));
  saveOrgScoped("daily_briefings", [record]);
  expect(remove()).toBe(true);
  expect(loadOrgScoped("daily_briefings", [])[0].deletedAt).toBeTruthy();
  expect(listRecycleBinEntries()).toHaveLength(1);
  localStorage.setItem("mysafeops_orgId", "default");
  expect(loadOrgScoped("daily_briefings", [])[0]).toEqual(record);
  expect(listRecycleBinEntries()).toEqual([]);
});
