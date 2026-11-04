/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import ProjectDashboard from "./ProjectDashboard";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let host, root;
const project = { id: "source", name: "Source site", site: "Test site", startupChecklist: [] };
const targets = [project, { id: "target", name: "Target site" }, { id: "closed", name: "Closed site", closed: true }];

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("mysafeops_orgId", "test-org");
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
  vi.restoreAllMocks();
});

it("offers an active destination by name and copies photos only when selected", async () => {
  const onCloneDocuments = vi.fn();
  await act(async () => root.render(<ProjectDashboard project={project} allProjects={targets} onCloneDocuments={onCloneDocuments} onClose={vi.fn()} />));
  await act(async () => [...host.querySelectorAll("button")].find((el) => el.textContent === "Clone docs to project").click());
  const select = host.querySelector("#project-clone-target");
  expect([...select.options].map((option) => option.textContent)).toEqual(["Choose a project", "Target site"]);
  await act(async () => {
    select.value = "target";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await act(async () => {
    const checkbox = host.querySelector('.app-project-dashboard__clone-check input');
    checkbox.click();
  });
  await act(async () => host.querySelector("#project-clone-options").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  expect(onCloneDocuments).toHaveBeenCalledWith(project, "target", { includeGeoPhotos: true });
  expect(host.querySelector("#project-clone-options")).toBeNull();
});

it("closes the site profile with Escape and restores page scrolling", async () => {
  const onClose = vi.fn();
  document.body.style.overflow = "auto";
  await act(async () => root.render(<ProjectDashboard project={project} onClose={onClose} />));
  expect(document.body.style.overflow).toBe("hidden");
  await act(async () => host.querySelector('[role="dialog"]').dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  expect(onClose).toHaveBeenCalledOnce();
  await act(async () => root.unmount());
  expect(document.body.style.overflow).toBe("auto");
  root = createRoot(host);
});
