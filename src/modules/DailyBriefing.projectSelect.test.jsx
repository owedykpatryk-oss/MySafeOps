import { overlayDraftKey } from "../hooks/useOverlayFormDraft";
/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import DailyBriefing from "./DailyBriefing";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
vi.mock("../hooks/useD1OrgArraySync", () => ({ useD1OrgArraySync: () => ({}) }));
vi.mock("../hooks/useD1WorkersProjectsSync", () => ({ useD1WorkersProjectsSync: () => ({}) }));
vi.mock("../components/PageHero", () => ({ default: ({ right }) => <>{right}</> }));
vi.mock("../components/RegisterModuleShell", () => ({ default: ({ children, filters }) => <>{filters}{children}</> }));
let root, host;
beforeEach(() => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  localStorage.clear();
  sessionStorage.clear();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); sessionStorage.clear(); localStorage.clear(); vi.restoreAllMocks(); });
async function open(projects = [], draft = null) {
  localStorage.setItem("mysafeops_projects_default", JSON.stringify(projects));
  if (draft) sessionStorage.setItem(overlayDraftKey("briefing", "new"), JSON.stringify(draft));
  await act(async () => root.render(<DailyBriefing />));
  const button = [...host.querySelectorAll("button")].find(el => el.textContent.trim() === "+ New briefing");
  await act(async () => button.click());
  return host.querySelector("#daily-briefing-project-id");
}

it.each([[], [{ id: "p1", name: "North depot" }]])("shows the placeholder before opening the project list: %j", async (projects) => {
  const select = await open(projects);
  expect(select.value).toBe("");
  expect(select.selectedOptions[0].textContent).toContain("Select project");
});

it.each([
  [{ id: "p1", name: "", site: "Client site" }, "Client site"],
  [{ id: "p1", name: "   ", site: " " }, "p1"],
  [{ id: "p1" }, "p1"],
])("never renders a blank selected label for a restored legacy project %j", async (project, expected) => {
  const select = await open([project], { projectId: "p1" });
  expect(select.value).toBe("p1");
  expect(select.selectedOptions[0].textContent).toBe(expected);
});

it("retains a valid restored selection and allows clearing it back to the placeholder", async () => {
  const select = await open([{ id: "p1", name: "North depot" }], { projectId: "p1" });
  expect(select.selectedOptions[0].textContent).toBe("North depot");
  await act(async () => { select.value = ""; select.dispatchEvent(new Event("change", { bubbles: true })); });
  expect(select.value).toBe("");
  expect(select.selectedOptions[0].textContent).toContain("Select project");
});
