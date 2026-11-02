/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BillingUsageWarning from "./BillingUsageWarning";
import { saveOrgScoped } from "../utils/orgStorage";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const mocks = vi.hoisted(() => ({ app: {} }));
vi.mock("../context/AppContext", () => ({ useApp: () => mocks.app }));
let root, container;
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("mysafeops_orgId", "usage-test");
  mocks.app = { orgId: "usage-test", trialStatus: null, billing: { paidPlanId: "starter", subscriptionStatus: "active" }, isPlatformOwner: false };
  container = document.createElement("div");
  root = createRoot(container);
});
afterEach(() => act(() => root.unmount()));

describe("Billing usage warning", () => {
  it("shows the warning at the exact plan cap, not only below it", () => {
    localStorage.setItem("mysafeops_workers_usage-test", JSON.stringify(Array.from({ length: 5 }, (_, i) => ({ id: String(i) }))));
    act(() => root.render(<BillingUsageWarning />));
    expect(container.textContent).toContain("5/5 (limit reached)");
  });
  it("updates after same-tab writes without reloading the page", () => {
    act(() => root.render(<BillingUsageWarning />));
    expect(container.textContent).toBe("");
    act(() => saveOrgScoped("mysafeops_workers", Array.from({ length: 4 }, (_, i) => ({ id: String(i) }))));
    expect(container.textContent).toContain("4/5 (80% of plan)");
  });
  it("does not show ordinary subscription limits to the platform owner", () => {
    mocks.app.isPlatformOwner = true;
    localStorage.setItem("mysafeops_workers_usage-test", JSON.stringify(Array.from({ length: 5 }, (_, i) => ({ id: String(i) }))));
    act(() => root.render(<BillingUsageWarning />));
    expect(container.textContent).toBe("");
  });
});
