/** @vitest-environment jsdom */
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import WorkspaceAppBar from "./WorkspaceAppBar";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
vi.mock("../context/SupabaseAuthContext", () => ({ useSupabaseAuth: () => ({ user: null, supabase: null }) }));
vi.mock("../lib/supabase", () => ({ isSupabaseConfigured: () => false }));
vi.mock("../hooks/useOrgBranding", () => ({ useOrgBranding: () => ({ displayName: "QA workspace" }) }));
function Workspace() {
  const [view, setView] = useState("settings");
  return <WorkspaceAppBar view={view} navTab={view === "settings" ? "more" : view}
    onGoDashboard={() => setView("dashboard")} onOpenHelp={() => setView("help")}
    onOpenSettings={() => setView("settings")} />;
}
let host, root;
beforeEach(async () => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<MemoryRouter initialEntries={["/app?view=settings"]}><Workspace /></MemoryRouter>));
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

it("opens Dashboard from Settings using the desktop header control", async () => {
  expect(host.querySelector("h1").textContent).toBe("Settings");
  await act(async () => host.querySelector('[aria-label="Go to dashboard"]').click());
  expect(host.querySelector("h1").textContent).toBe("Dashboard");
});

it("keeps the compact menu Dashboard action working and closes the menu", async () => {
  await act(async () => host.querySelector('[aria-label="More actions"]').click());
  const item = [...host.querySelectorAll('[role="menuitem"]')].find(el => el.textContent === "Dashboard");
  await act(async () => item.click());
  expect(host.querySelector("h1").textContent).toBe("Dashboard");
  expect(host.querySelector('[role="menu"]')).toBeNull();
});

it("keeps Help and Settings working after returning to Dashboard", async () => {
  for (const [label, title] of [["Go to dashboard", "Dashboard"], ["Open Help", "Help"], ["Open Settings", "Settings"]]) {
    await act(async () => host.querySelector(`[aria-label="${label}"]`).click());
    expect(host.querySelector("h1").textContent).toBe(title);
  }
});
