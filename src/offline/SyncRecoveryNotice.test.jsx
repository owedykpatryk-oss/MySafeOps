/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import SyncRecoveryNotice from "./SyncRecoveryNotice";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const mocks = vi.hoisted(() => ({ org: "acme", country: null, read: vi.fn(), download: vi.fn() }));
vi.mock("../lib/d1SyncClient", () => ({ isD1Configured: () => true }));
vi.mock("../lib/d1SyncOutbox", () => ({ D1_OUTBOX_CHANGED_EVENT: "outbox-changed", d1OutboxRecoveryForWorkspace: mocks.read }));
vi.mock("../utils/orgStorage", () => ({ getOrgId: () => mocks.org, ORG_CHANGED_EVENT: "org-changed" }));
vi.mock("../utils/countryWorkspaces", () => ({ getCachedActiveCountryWorkspace: () => mocks.country, COUNTRY_WORKSPACE_CHANGED_EVENT: "country-changed" }));
vi.mock("../utils/downloadBlob", () => ({ downloadBlob: mocks.download }));
let root;
let container;
beforeEach(() => {
  mocks.org = "acme";
  mocks.country = null;
  mocks.read.mockReset();
  mocks.download.mockReset().mockReturnValue(true);
  container = document.createElement("div");
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); });

it("offers a recovery download without deleting or restoring records", async () => {
  mocks.read.mockResolvedValue([{ id: "op1", value: [{ id: "local" }], serverValue: [{ id: "cloud" }] }]);
  await act(async () => root.render(<SyncRecoveryNotice />));
  expect(container.textContent).toContain("Sync recovery copies available (1)");
  expect(container.textContent).toContain("does not restore or overwrite");
  act(() => container.querySelector("button").click());
  expect(mocks.download).toHaveBeenCalledWith(expect.any(Blob), "mysafeops-sync-recovery.json");
  expect(container.textContent).toContain("available (1)");
});

it("hides the old company's copies immediately and ignores its late response", async () => {
  let resolveOld;
  mocks.read.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; })).mockResolvedValue([]);
  await act(async () => root.render(<SyncRecoveryNotice />));
  await act(async () => {
    mocks.org = "other";
    window.dispatchEvent(new Event("org-changed"));
  });
  await act(async () => resolveOld([{ id: "private" }]));
  expect(container.textContent).toBe("");
  expect(mocks.read).toHaveBeenLastCalledWith("other", null);
});

it("prevents download from the previous scope before a rerender and uses the secondary country", async () => {
  mocks.read.mockResolvedValue([{ id: "private" }]);
  await act(async () => root.render(<SyncRecoveryNotice />));
  mocks.org = "other";
  act(() => container.querySelector("button").click());
  expect(mocks.download).not.toHaveBeenCalled();
  mocks.country = { id: "pl", is_primary: false };
  await act(async () => window.dispatchEvent(new Event("country-changed")));
  expect(mocks.read).toHaveBeenLastCalledWith("other", "pl");
});

it("reports a failed download while keeping the recovery action available", async () => {
  mocks.read.mockResolvedValue([{ id: "op1" }]);
  mocks.download.mockReturnValue(false);
  await act(async () => root.render(<SyncRecoveryNotice />));
  act(() => container.querySelector("button").click());
  expect(container.querySelector('[role="alert"]').textContent).toContain("still saved on this device");
  expect(container.querySelector("button")).not.toBeNull();
});

async function dismissNotice() {
  const close = container.querySelector('[aria-label="Dismiss sync recovery notice"]');
  expect(close).not.toBeNull();
  await act(async () => close.click());
}

it("collapses the notice without changing copies and allows reopening the download", async () => {
  const rows = [{ id: "op1", recoveredAt: "2026-10-30T09:00:00Z", value: [{ id: "local" }], serverValue: [{ id: "cloud" }] }];
  const original = JSON.stringify(rows);
  mocks.read.mockResolvedValue(rows);
  await act(async () => root.render(<SyncRecoveryNotice />));
  await dismissNotice();
  expect(container.textContent).not.toContain("Sync recovery copies available");
  expect(container.textContent).toContain("Show recovery copies (1)");
  expect(mocks.download).not.toHaveBeenCalled();
  expect(JSON.stringify(rows)).toBe(original);
  await act(async () => window.dispatchEvent(new Event("focus")));
  expect(container.textContent).not.toContain("Sync recovery copies available");
  await act(async () => container.querySelector("button").click());
  expect(container.textContent).toContain("Sync recovery copies available (1)");
  act(() => container.querySelector("button").click());
  expect(mocks.download).toHaveBeenCalledOnce();
});

it.each([
  { id: "op2", recoveredAt: "2026-10-30T09:00:00Z", serverVersion: 2 },
  { id: "op1", recoveredAt: "2026-10-30T10:00:00Z", serverVersion: 3 },
])("shows a new or updated conflict even when the copy count stays the same: %j", async (next) => {
  mocks.read.mockResolvedValue([{ id: "op1", recoveredAt: "2026-10-30T09:00:00Z", serverVersion: 2 }]);
  await act(async () => root.render(<SyncRecoveryNotice />));
  await dismissNotice();
  mocks.read.mockResolvedValue([next]);
  await act(async () => window.dispatchEvent(new Event("outbox-changed")));
  expect(container.textContent).toContain("Sync recovery copies available (1)");
});

it.each(["organisation", "country"])("does not carry dismissal into another %s", async (scope) => {
  mocks.read.mockResolvedValue([{ id: "op1" }]);
  await act(async () => root.render(<SyncRecoveryNotice />));
  await dismissNotice();
  if (scope === "organisation") mocks.org = "other";
  else mocks.country = { id: "pl", is_primary: false };
  await act(async () => window.dispatchEvent(new Event(scope === "organisation" ? "org-changed" : "country-changed")));
  expect(container.textContent).toContain("Sync recovery copies available (1)");
});

it("allows dismissing a storage error and reveals a new error after copies were dismissed", async () => {
  mocks.read.mockResolvedValue([{ id: "op1" }]);
  await act(async () => root.render(<SyncRecoveryNotice />));
  await dismissNotice();
  mocks.read.mockRejectedValue(new Error("storage unavailable"));
  await act(async () => window.dispatchEvent(new Event("focus")));
  expect(container.querySelector('[role="alert"]').textContent).toContain("could not be read");
  await dismissNotice();
  expect(container.querySelector('[role="alert"]')).toBeNull();
});
