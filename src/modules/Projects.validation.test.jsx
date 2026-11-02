/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import Projects from "./Projects";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const mocks = vi.hoisted(() => ({ toast: vi.fn(), playbook: vi.fn() }));
vi.mock("../context/AppContext", () => ({ useApp: () => ({ isPlatformOwner: true }) }));
vi.mock("../context/SupabaseAuthContext", () => ({ useSupabaseAuth: () => ({ user: null }) }));
vi.mock("../context/ToastContext", () => ({ useToast: () => ({ pushToast: mocks.toast }) }));
vi.mock("../hooks/useD1WorkersProjectsSync", () => ({ useD1WorkersProjectsSync: () => ({}) }));
vi.mock("../components/ProjectSitePreviewMap", () => ({ default: () => null }));
vi.mock("../components/ProjectDashboard", () => ({ default: () => <div>Saved project dashboard</div> }));
vi.mock("../utils/projectPlaybooks", async (original) => ({
  ...await original(), applyAndPersistProjectPlaybook: (...args) => mocks.playbook(...args),
}));
let root, host;
beforeEach(() => {
  localStorage.clear();
  mocks.toast.mockReset();
  mocks.playbook.mockReset().mockImplementation((project) => ({ project, applied: false }));
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); localStorage.clear(); });
async function click(label) {
  const button = [...host.querySelectorAll("button")].find((el) => el.textContent.trim() === label);
  expect(button, label).toBeDefined();
  await act(async () => button.click());
}
async function fill(id, value) {
  const input = host.querySelector(`#${id}`);
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function open() {
  await act(async () => root.render(<MemoryRouter><Projects /></MemoryRouter>));
  await click("Add project");
}
const records = () => JSON.parse(localStorage.getItem("mysafeops_projects_default") || "[]");

it.each([
  ["", "", "workers-name-2"], ["   ", " \t ", "workers-name-2"],
  ["Survey", "", "workers-site"], ["", "Client", "workers-name-2"],
])("blocks incomplete projects (%j / %j) without record or playbook side effects", async (name, site, focusId) => {
  await open();
  await fill("workers-name-2", name);
  await fill("workers-site", site);
  await click("Save");
  expect(records()).toEqual([]);
  expect(mocks.playbook).not.toHaveBeenCalled();
  expect(mocks.toast.mock.calls.some(([, tone]) => tone === "success")).toBe(false);
  expect(host.querySelector(`#${focusId}`).getAttribute("aria-invalid")).toBe("true");
  expect(document.activeElement.id).toBe(focusId);
  expect(host.textContent).toContain("Required field");
});

it("blocks Save + drawing editor with the same validation", async () => {
  await open();
  await click("Save + drawing editor");
  expect(records()).toEqual([]);
  expect(mocks.playbook).not.toHaveBeenCalled();
  expect(host.querySelector("#workers-name-2")).not.toBeNull();
});

it("saves exactly once after missing fields are corrected", async () => {
  await open();
  await click("Save");
  expect(records()).toEqual([]);
  await fill("workers-name-2", "  Survey project  ");
  await fill("workers-site", "  Client site  ");
  await click("Save");
  expect(records()).toHaveLength(1);
  expect(records()[0]).toMatchObject({ name: "Survey project", site: "Client site" });
  expect(mocks.playbook).toHaveBeenCalledTimes(1);
  expect(host.querySelector("#workers-name-2")).toBeNull();
});

it("returns an incomplete restored draft to the required fields before saving", async () => {
  localStorage.setItem("project_wizard_draft_default", JSON.stringify({
    form: { id: "draft-1", name: "", site: "Client" }, step: 5, savedAt: new Date().toISOString(),
  }));
  await open();
  expect(host.querySelector("#workers-name-2")).toBeNull();
  await click("Save");
  expect(records()).toEqual([]);
  expect(mocks.playbook).not.toHaveBeenCalled();
  expect(document.activeElement.id).toBe("workers-name-2");
  expect(localStorage.getItem("project_wizard_draft_default")).not.toBe("null");
});

it("does not overwrite an existing project when a required field is cleared", async () => {
  const original = { id: "existing", name: "Existing project", site: "Original site" };
  localStorage.setItem("mysafeops_projects_default", JSON.stringify([original]));
  await act(async () => root.render(<MemoryRouter><Projects /></MemoryRouter>));
  await click("Edit");
  await fill("workers-site", "   ");
  await click("Save");
  expect(records()).toEqual([original]);
  expect(document.activeElement.id).toBe("workers-site");
  expect(mocks.playbook).not.toHaveBeenCalled();
});
