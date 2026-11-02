/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import WorkspaceSearchPalette from "./WorkspaceSearchPalette";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const hit = { key: "rams-1", kind: "RAMS", label: "Excavation", viewId: "rams", ramsId: "document-1", projectId: "site-1", action: "edit" };
vi.mock("../utils/workspaceSearch", () => ({ buildWorkspaceSearchHits: () => [hit] }));
vi.mock("../utils/pinnedModules", () => ({ getPinnedModuleIds: () => [] }));
vi.mock("../utils/recentModules", () => ({ getRecentModuleIds: () => [] }));
vi.mock("../navigation/moduleCatalogMeta", () => ({ getModuleIcon: () => null, preloadModuleIcons: () => Promise.resolve() }));
let container, root, trigger;
beforeEach(() => {
  container = document.createElement("div");
  trigger = document.createElement("button");
  document.body.append(trigger, container);
  trigger.focus();
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); trigger.remove(); vi.unstubAllGlobals(); });

it("passes the complete record target when a search result is selected", async () => {
  const onNavigate = vi.fn(), onClose = vi.fn();
  await act(async () => root.render(<WorkspaceSearchPalette open onNavigate={onNavigate} onClose={onClose} />));
  act(() => Array.from(container.querySelectorAll("button")).find((button) => button.textContent.includes("Excavation")).click());
  expect(onNavigate).toHaveBeenCalledWith(hit);
  expect(onClose).toHaveBeenCalledOnce();
});

it("keeps keyboard focus inside the search dialog and restores it on close", async () => {
  const props = { onNavigate: vi.fn(), onClose: vi.fn() };
  await act(async () => root.render(<WorkspaceSearchPalette open {...props} />));
  const input = container.querySelector("input");
  input.focus();
  act(() => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true })));
  expect(document.activeElement.textContent).toContain("Excavation");
  act(() => document.activeElement.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true })));
  expect(document.activeElement).toBe(input);
  await act(async () => root.render(<WorkspaceSearchPalette open={false} {...props} />));
  expect(document.activeElement).toBe(trigger);
});

it("fits the visible mobile viewport when the keyboard reduces its height", async () => {
  const viewport = Object.assign(new EventTarget(), { height: 700, offsetTop: 0 });
  vi.stubGlobal("visualViewport", viewport);
  await act(async () => root.render(<WorkspaceSearchPalette open onNavigate={vi.fn()} onClose={vi.fn()} />));
  const overlay = container.querySelector(".app-search-overlay");
  expect(overlay.style.height).toBe("700px");
  await act(async () => {
    viewport.height = 300;
    viewport.offsetTop = 24;
    viewport.dispatchEvent(new Event("resize"));
  });
  expect(overlay.style.height).toBe("300px");
  expect(overlay.style.top).toBe("24px");
  expect(container.querySelector(".app-search-dialog").style.maxHeight).toBe("100%");
});
