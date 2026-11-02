/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import CountryWorkspaceBilling from "./CountryWorkspaceBilling";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const state = vi.hoisted(() => ({ rows: [] }));
vi.mock("../context/ToastContext", () => ({ useToast: () => ({ pushToast: vi.fn() }) }));
vi.mock("../utils/countryWorkspaces", async (original) => ({
  ...await original(),
  ensureLegacyCountryWorkspace: vi.fn(),
  loadCountryWorkspaces: async () => state.rows,
}));
let root, host;
beforeEach(() => {
  localStorage.clear();
  vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-30T12:00:00Z"));
  state.rows = [{ id: "uk", enabled: true, is_primary: true, market_id: "uk", display_name: "United Kingdom",
    default_document_locale: "en-GB", evaluation_trial_ends_at: "2027-01-01T00:00:00Z", billing: null }];
  host = document.createElement("div");
  root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); vi.restoreAllMocks(); });
async function render() {
  await act(async () => root.render(<CountryWorkspaceBilling supabase={{}} orgSlug="acme" isAdmin />));
}

it("shows primary evaluation access and exact expiry instead of a subscription-required warning", async () => {
  await render();
  expect(host.textContent).toContain("Evaluation active");
  expect(host.querySelector("time").dateTime).toBe("2027-01-01T00:00:00Z");
  expect(host.textContent).toContain("UTC");
  expect(host.textContent).not.toContain("has no active subscription");
  expect(host.textContent).not.toContain("Subscription required");
});

it.each(["2026-10-30T12:00:00Z", "invalid", null])("requires a subscription for an expired or invalid deadline %s", async (deadline) => {
  state.rows[0].evaluation_trial_ends_at = deadline;
  await render();
  expect(host.textContent).toContain("Subscription required");
  expect(host.textContent).not.toContain("Evaluation active");
});

it("does not apply primary evaluation to another country", async () => {
  state.rows[0].is_primary = false;
  await render();
  expect(host.textContent).toContain("Subscription required");
});

it.each(["canceled", "unpaid", "past_due"])("does not restore evaluation for a %s subscription", async (status) => {
  state.rows[0].billing = { subscription_status: status };
  await render();
  expect(host.textContent).not.toContain("Evaluation active");
});

it("distinguishes an unavailable billing read from a missing subscription", async () => {
  state.rows[0].billing_unavailable = true;
  await render();
  expect(host.textContent).toContain("Billing status unavailable");
  expect(host.textContent).not.toContain("Subscription required");
  expect(host.textContent).not.toContain("has no active subscription");
  expect(host.textContent).not.toContain("Evaluation active");
});
