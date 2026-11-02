/** @vitest-environment jsdom */
import { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import BillingLimits from "./BillingLimits";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const mocks = vi.hoisted(() => ({ invoke: vi.fn(), toast: vi.fn(), paid: false, billing: null }));
vi.mock("../context/AppContext", () => ({ useApp: () => ({ orgId: "billing-qa", role: "admin", billing: null, trialStatus: null }) }));
vi.mock("../context/ToastContext", () => ({ useToast: () => ({ pushToast: mocks.toast }) }));
vi.mock("../lib/showAdminLoginHints", () => ({ showAdminLoginHints: () => false }));
vi.mock("../lib/billingTelemetry", () => ({ trackBillingError: vi.fn(), trackBillingEvent: vi.fn() }));
vi.mock("../utils/orgMembership", () => ({
  extendOrgTrial: vi.fn(), getTrialExtensionCount: () => 0, refreshOrgFromSupabase: vi.fn(),
  getBillingEntitlements: () => ({ paidPlanId: null, subscriptionStatus: "none" }),
}));
vi.mock("../lib/supabase", () => ({
  getSupabaseUrl: () => "https://billing.example.test",
  isSupabaseConfigured: () => true,
  supabase: {
    auth: { getSession: async () => ({ data: { session: { access_token: "test-session" } } }) },
    functions: { invoke: (...args) => mocks.invoke(...args) },
  },
}));
vi.mock("./CountryWorkspaceBilling", () => ({ default: function CountryWorkspace({ onWorkspaceChange, stripeMode }) {
  useEffect(() => {
    onWorkspaceChange({ id: "qa-workspace", is_primary: true, market_id: "uk", display_name: "UK",
      billing: mocks.billing || (mocks.paid ? { billing_plan: "team", subscription_status: "active" } : null) });
  }, [onWorkspaceChange]);
  return <div data-billing-mode={stripeMode} />;
} }));

let root, container;
beforeEach(() => {
  vi.stubEnv("DEV", false);
  localStorage.clear();
  window.history.replaceState({}, "", "/billing?stripeMode=live");
  mocks.paid = false;
  mocks.billing = null;
  mocks.invoke.mockReset().mockResolvedValue({ data: { error: "Intentional test stop before redirect" } });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 200, json: async () => ({
    activeMode: "test", activeReady: true, liveReady: false, testReady: true, marketBilling: { uk: true },
  }) }));
  container = document.createElement("div");
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  window.history.replaceState({}, "", "/");
});
async function render() {
  await act(async () => root.render(<MemoryRouter><BillingLimits /></MemoryRouter>));
}
async function clickButton(pattern) {
  const button = [...container.querySelectorAll("button")].find((el) => pattern.test(el.textContent));
  expect(button).toBeDefined();
  expect(button.disabled).toBe(false);
  await act(async () => button.click());
}

it("uses server Test Mode for the ordinary production checkout even with a stale live URL", async () => {
  await render();
  expect(container.textContent).toContain("Stripe Test Mode — no real payments");
  expect(container.querySelector("[data-billing-mode]").dataset.billingMode).toBe("test");
  await clickButton(/^Solo \(/);
  expect(mocks.invoke).toHaveBeenCalledWith("stripe-checkout", expect.objectContaining({ body: expect.objectContaining({
    planId: "starter", testMode: true, workspaceId: "qa-workspace", orgSlug: "billing-qa",
  }) }));
});

it("opens the ordinary billing portal in Test Mode with no live credentials", async () => {
  await render();
  await clickButton(/^Manage billing \(portal\)$/);
  expect(mocks.invoke).toHaveBeenCalledWith("stripe-portal", expect.objectContaining({ body: expect.objectContaining({ testMode: true }) }));
});

it("keeps paid test plan changes in the test portal", async () => {
  mocks.paid = true;
  await render();
  await clickButton(/^Manage billing \/ change plan$/);
  expect(mocks.invoke).toHaveBeenCalledWith("stripe-portal", expect.objectContaining({ body: expect.objectContaining({ testMode: true }) }));
});

it("offers a dedicated cancellation confirmation for the selected paid country", async () => {
  mocks.paid = true;
  await render();
  expect(container.textContent).toContain("Renews automatically every month");
  await clickButton(/^Cancel subscription$/);
  expect(mocks.invoke).toHaveBeenCalledWith("stripe-portal", expect.objectContaining({ body: expect.objectContaining({ action: "cancel", workspaceId: "qa-workspace", testMode: true }) }));
});

it("shows scheduled cancellation and the paid-through date", async () => {
  mocks.billing = { billing_plan: "team", subscription_status: "active", cancel_at_period_end: true, current_period_end: "2027-02-03T12:00:00Z" };
  await render();
  expect(container.textContent).toContain("Cancellation scheduled for 3 February 2027");
  expect(container.textContent).toContain("will not renew");
  expect([...container.querySelectorAll("button")].some(b=>b.textContent==="Cancel subscription")).toBe(false);
});

it.each(["past_due", "unpaid"])("directs %s to the existing subscription instead of a duplicate checkout", async (status) => {
  mocks.billing = { billing_plan: "team", subscription_status: status };
  await render();
  expect(container.textContent).not.toContain("Subscribe (Stripe Checkout)");
  await clickButton(/^Resolve payment \/ manage billing$/);
  expect(mocks.invoke).toHaveBeenCalledWith("stripe-portal", expect.objectContaining({ body: expect.objectContaining({ action: "manage" }) }));
});
