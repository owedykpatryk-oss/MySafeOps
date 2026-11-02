/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RecycleBin from "./RecycleBin";
import { saveOrgScoped, setOrgId } from "../utils/orgStorage";
import { RECYCLE_BIN_KEY } from "../utils/recycleBin";
import { cacheActiveCountryWorkspace } from "../utils/countryWorkspaces";

vi.mock("../components/PageHero", () => ({ default: () => null }));
vi.mock("../components/RegisterListPagingFooter", () => ({ default: () => null }));
vi.mock("../i18n/useWorkspaceT", () => ({ useWorkspaceT: () => ({ t: (key) => key }) }));

const entry = (id, label) => ({
  id, itemLabel: label, moduleLabel: "RAMS", itemType: "rams", sourceKey: "rams_builder_docs",
  payload: { id }, deletedAt: "2026-10-01T00:00:00.000Z", expiresAt: "2030-10-01T00:00:00.000Z",
});

describe("RecycleBin workspace isolation", () => {
  let root;
  let container;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.clear();
    setOrgId("company-a");
    saveOrgScoped(RECYCLE_BIN_KEY, [entry("a", "Company A RAMS")]);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("removes the previous company's deleted items from the open screen", async () => {
    setOrgId("company-b");
    saveOrgScoped(RECYCLE_BIN_KEY, [entry("b", "Company B RAMS")]);
    setOrgId("company-a");
    await act(async () => root.render(<RecycleBin />));
    expect(container.textContent).toContain("Company A RAMS");

    await act(async () => setOrgId("company-b"));
    expect(container.textContent).toContain("Company B RAMS");
    expect(container.textContent).not.toContain("Company A RAMS");
  });

  it("removes the primary country's deleted items after switching country", async () => {
    cacheActiveCountryWorkspace({ id: "pl", is_primary: false });
    localStorage.setItem("mysafeops_billing_plan_company-a", "team");
    localStorage.setItem("mysafeops_subscription_status_company-a", "active");
    saveOrgScoped(RECYCLE_BIN_KEY, [entry("pl", "Poland RAMS")]);
    localStorage.removeItem("mysafeops_billing_plan_company-a");
    localStorage.removeItem("mysafeops_subscription_status_company-a");
    cacheActiveCountryWorkspace(null);
    await act(async () => root.render(<RecycleBin />));
    expect(container.textContent).toContain("Company A RAMS");

    await act(async () => cacheActiveCountryWorkspace({ id: "pl", is_primary: false }));
    expect(container.textContent).toContain("Poland RAMS");
    expect(container.textContent).not.toContain("Company A RAMS");
  });
});
