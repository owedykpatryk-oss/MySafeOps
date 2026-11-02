/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import CountryWorkspaceSwitcher from "./CountryWorkspaceSwitcher";
import { getTrialStatus } from "../utils/billingState";
import { isBillingWriteBlocked } from "../utils/billingAccess";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const state = vi.hoisted(() => ({ workspace: null }));
vi.mock("../context/AppContext", () => ({ useApp: () => ({ orgId: "acme", role: "admin" }) }));
vi.mock("../utils/countryWorkspaces", async (original) => ({
  ...await original(),
  ensureLegacyCountryWorkspace: vi.fn(),
  loadCountryWorkspaces: async () => [state.workspace],
}));
let root;
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("mysafeops_orgId", "acme");
  localStorage.setItem("mysafeops_trial_ends_at_acme", "2020-01-01T00:00:00Z");
  vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-30T12:00:00Z"));
  state.workspace = { id: "uk", enabled: true, is_primary: true, market_id: "uk", display_name: "United Kingdom",
    evaluation_trial_ends_at: "2020-01-01T00:00:00Z", billing: null };
  root = createRoot(document.createElement("div"));
});
afterEach(async () => { await act(async () => root.unmount()); vi.restoreAllMocks(); localStorage.clear(); });
async function render() { await act(async () => root.render(<CountryWorkspaceSwitcher supabase={{}} />)); }
async function refresh(deadline) {
  state.workspace = { ...state.workspace, evaluation_trial_ends_at: deadline };
  await act(async () => window.dispatchEvent(new Event("focus")));
}

it("automatically unlocks the primary evaluation after its server deadline is extended", async () => {
  await render();
  expect(isBillingWriteBlocked({ isPlatformOwner: false })).toBe(true);
  await refresh("2027-01-01T00:00:00Z");
  expect(getTrialStatus().endsAtIso).toBe("2027-01-01T00:00:00.000Z");
  expect(isBillingWriteBlocked({ isPlatformOwner: false })).toBe(false);
});

it("removes a cached grant when the server clears the evaluation deadline", async () => {
  localStorage.setItem("mysafeops_trial_ends_at_acme", "2027-01-01T00:00:00Z");
  state.workspace.evaluation_trial_ends_at = null;
  await render();
  expect(isBillingWriteBlocked({ isPlatformOwner: false })).toBe(true);
});

it("does not extend secondary countries or overwrite the organisation trial from them", async () => {
  state.workspace.is_primary = false;
  state.workspace.evaluation_trial_ends_at = "2027-01-01T00:00:00Z";
  await render();
  expect(isBillingWriteBlocked({ isPlatformOwner: false })).toBe(true);
  expect(localStorage.getItem("mysafeops_trial_ends_at_acme")).toBe("2020-01-01T00:00:00Z");
});

it("keeps the previous trial when billing cannot be read", async () => {
  state.workspace.billing_unavailable = true;
  state.workspace.evaluation_trial_ends_at = "2027-01-01T00:00:00Z";
  await render();
  expect(isBillingWriteBlocked({ isPlatformOwner: false })).toBe(true);
});
