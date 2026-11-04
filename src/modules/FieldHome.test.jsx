/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import FieldHome from "./FieldHome";

const state = vi.hoisted(() => ({ rows: [], hidden: [], scope: "A", user: "user-a" }));
const nav = vi.hoisted(() => ({ open: vi.fn(), target: vi.fn() }));
vi.mock("../context/SupabaseAuthContext", () => ({ useSupabaseAuth: () => ({ user: { id: state.user } }) }));
vi.mock("../hooks/useD1OrgArraySync", () => ({ useD1OrgArraySync: () => ({}) }));
vi.mock("../components/D1ModuleSyncBanner", () => ({ D1ModuleSyncBanner: () => null }));
vi.mock("../utils/orgStorage", () => ({ loadOrgScoped: () => state.rows, saveOrgScoped: vi.fn(), countryOperationalStorageKey: key => `${key}:${state.scope}`, ORG_DATA_CHANGED_EVENT: "org-data" }));
vi.mock("../utils/hiddenModules", () => ({ isModuleVisible: id => !state.hidden.includes(id), HIDDEN_MODULES_UPDATED_EVENT: "visibility" }));
vi.mock("../utils/workspaceNavContext", () => ({ openWorkspaceView: nav.open, setWorkspaceNavTarget: nav.target }));
vi.mock("../utils/soloWorkspace", () => ({ projectMissingItems: () => ["Address"] }));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let host, root;
const button = title => [...host.querySelectorAll("button")].find(el => el.textContent.startsWith(title));
async function render() { await act(async () => root.render(<FieldHome key={`${state.scope}:${state.user}`} />)); }
async function selectSite(id) { await act(async () => { const el = host.querySelector("select"); el.value = id; el.dispatchEvent(new Event("change", { bubbles: true })); }); }
beforeEach(async () => {
  vi.clearAllMocks(); sessionStorage.clear(); state.scope = "A"; state.user = "user-a"; state.hidden = [];
  state.rows = [{ id: "a", name: "Site A" }, { id: "deleted", name: "Deleted", deletedAt: "2026-01-01" }];
  host = document.createElement("div"); document.body.append(host); root = createRoot(host); await render();
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

it("requires a live selected site and passes it to survey creation", async () => {
  expect(button("Survey report").disabled).toBe(true);
  expect(host.querySelectorAll("option")).toHaveLength(2);
  await selectSite("a");
  await act(async () => button("Survey report").click());
  expect(nav.target).toHaveBeenLastCalledWith({ viewId: "survey-report", projectId: "a", action: "createReport" });
  expect(nav.open).toHaveBeenLastCalledWith({ viewId: "survey-report" });
});

it("opens project editing directly from the incomplete site profile prompt", async () => {
  await selectSite("a");
  await act(async () => button("Complete site profile").click());
  expect(nav.target).toHaveBeenLastCalledWith({ viewId: "projects", projectId: "a", action: "editProject" });
  expect(nav.open).toHaveBeenLastCalledWith({ viewId: "projects" });
});

it("passes the site to GPR and photo capture but clears stale targets for register links", async () => {
  await selectSite("a");
  await act(async () => button("GPR report").click());
  expect(nav.target).toHaveBeenLastCalledWith({ viewId: "gpr-report", projectId: "a" });
  await act(async () => button("Add site photos").click());
  expect(nav.target).toHaveBeenLastCalledWith({ viewId: "geo-photos", projectId: "a", action: "capture" });
  await act(async () => button("RAMS").click());
  expect(nav.target).toHaveBeenLastCalledWith({ viewId: "rams" });
});

it("keeps site selection separate for accounts and workspaces", async () => {
  await selectSite("a"); state.scope = "B"; state.rows = [{ id: "b", name: "Site B" }]; await render();
  expect(host.querySelector("select").value).toBe(""); expect(host.textContent).not.toContain("Site A");
  state.scope = "A"; state.rows = [{ id: "a", name: "Site A" }]; await render();
  expect(host.querySelector("select").value).toBe("a");
  state.user = "user-b"; await render(); expect(host.querySelector("select").value).toBe("");
});

it("removes disabled modules immediately when visibility changes", async () => {
  state.hidden = ["survey-report", "gpr-report", "rams"];
  await act(async () => window.dispatchEvent(new Event("visibility")));
  expect(button("Survey report")).toBeUndefined(); expect(button("GPR report")).toBeUndefined(); expect(button("RAMS")).toBeUndefined();
});

it("refreshes sites changed in another tab", async () => {
  await selectSite("a");
  state.rows = [{ id: "b", name: "New site" }];
  await act(async () => window.dispatchEvent(new StorageEvent("storage", { key: "mysafeops_projects:A", storageArea: localStorage })));
  expect(host.querySelector("select").textContent).toContain("New site");
  expect(button("Survey report").disabled).toBe(true);
});

it("refuses a removed project even before its storage event is delivered", async () => {
  await selectSite("a"); state.rows = [];
  await act(async () => button("Survey report").click());
  expect(nav.open).not.toHaveBeenCalled();
});

it("refuses navigation after the workspace changed before React rerendered", async () => {
  await selectSite("a"); state.scope = "B";
  await act(async () => button("Survey report").click());
  expect(nav.open).not.toHaveBeenCalled();
});

it("moves keyboard focus to the selected panel and remembers the section", async () => {
  await act(async () => button("Documents").click());
  expect(document.activeElement).toBe(host.querySelector("#field-panel"));
  expect(host.querySelector("#field-panel").getAttribute("aria-label")).toBe("Documents");
  await act(async () => root.render(<FieldHome key="return-visit" />));
  expect(host.querySelector("#field-panel").getAttribute("aria-label")).toBe("Documents");
});
