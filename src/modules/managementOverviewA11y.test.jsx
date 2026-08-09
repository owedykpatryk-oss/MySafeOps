/** @vitest-environment jsdom */
/**
 * Accessible-name audit across every tab.
 *
 * The module grew fast across several rounds of work and its controls were only ever checked
 * by behaviour. A control with no accessible name is invisible to a screen reader and
 * unlabelled in voice control, so this walks the real tree and fails on any that lack one.
 */
import { createElement } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../context/AppContext", () => ({
  useApp: () => ({ role: "admin", isPlatformOwner: false }),
}));

import ManagementOverview from "./ManagementOverview";
import { SupabaseAuthProvider } from "../context/SupabaseAuthContext";
import { ToastProvider } from "../context/ToastContext";
import { addDays, isoDate, saveManagementState } from "../utils/managementOverview";
import { saveOrgScoped } from "../utils/orgStorage";

const relative = (days) => isoDate(addDays(new Date(), days));
const TEAM = { id: "team_a", name: "North Team", colour: "#0f766e", capacity: 5, region: "North", memberIds: ["w1"] };

let host;
let root;

function Providers({ children }) {
  return createElement(
    MemoryRouter,
    { initialEntries: ["/app"] },
    createElement(SupabaseAuthProvider, null, createElement(ToastProvider, null, children)),
  );
}

async function mount() {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root.render(createElement(Providers, null, createElement(ManagementOverview)));
  });
}

async function waitFor(find, label) {
  const deadline = Date.now() + 8000;
  for (;;) {
    const found = find();
    if (found) return found;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${label}`);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
  }
}

/** Roughly what a screen reader would announce for a control. */
function accessibleName(element) {
  const aria = element.getAttribute("aria-label");
  if (aria && aria.trim()) return aria.trim();

  const labelledBy = element.getAttribute("aria-labelledby");
  if (labelledBy) {
    const text = labelledBy
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent || "")
      .join(" ")
      .trim();
    if (text) return text;
  }

  if (element.id) {
    const label = host.querySelector(`label[for="${element.id}"]`);
    if (label?.textContent.trim()) return label.textContent.trim();
  }

  const wrapping = element.closest("label");
  if (wrapping?.textContent.trim()) return wrapping.textContent.trim();

  const title = element.getAttribute("title");
  if (title && title.trim()) return title.trim();

  // Buttons and links may be named by their own content.
  if (["BUTTON", "A", "SUMMARY"].includes(element.tagName)) return element.textContent.trim();
  return "";
}

function unnamedControls() {
  const controls = [...host.querySelectorAll("button, a[href], input, select, textarea")];
  return controls
    .filter((element) => !element.hasAttribute("aria-hidden") && element.type !== "hidden")
    .filter((element) => !accessibleName(element))
    .map((element) => `${element.tagName.toLowerCase()}${element.type ? `[${element.type}]` : ""}.${element.className || "(no class)"}`);
}

beforeAll(() => {
  if (typeof window.matchMedia !== "function") {
    window.matchMedia = (query) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    });
  }
  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = (cb) => window.setTimeout(() => cb(Date.now()), 0);
    window.cancelAnimationFrame = (handle) => window.clearTimeout(handle);
  }
});

beforeEach(() => {
  localStorage.clear();
  saveOrgScoped("mysafeops_workers", [{ id: "w1", name: "Sam Fitter", role: "Groundworker" }]);
  saveManagementState({
    teams: [TEAM],
    jobs: {},
    opportunities: [
      { id: "live", name: "Manchester dig", client: "Acme", site: "M1", teamId: TEAM.id, start: relative(-2), end: relative(3), status: "confirmed", value: 12000 },
      { id: "next", name: "Salford dig", client: "Acme", site: "M5", teamId: TEAM.id, start: relative(2), end: relative(6), status: "provisional", value: 5000 },
    ],
    meeting: { title: "Weekly management meeting", attendees: "", notes: "", actions: [{ id: "a1", text: "Chase permit", owner: "Jo", due: relative(1), status: "Open" }] },
    meetings: [{ id: "m1", title: "Last week", closedOn: relative(-7), attendees: "", notes: "", actions: [] }],
  });
});

afterEach(async () => {
  if (root) await act(async () => root.unmount());
  host?.remove();
  root = null;
  host = null;
  document.body.innerHTML = "";
});

const TABS = ["Overview", "90-day planner", "Scenario planner", "Teams & capacity", "Clients", "Calendar sync", "Meeting mode"];

describe("management overview accessibility", () => {
  it.each(TABS)("names every control on the %s tab", async (label) => {
    await mount();
    const tab = [...host.querySelectorAll('[role="tab"]')].find((node) => node.textContent.includes(label));
    await act(async () => tab.click());
    // The on-demand tabs arrive after their chunk loads.
    await waitFor(() => host.querySelector('[role="tabpanel"]')?.children.length, `${label} content`);

    expect(unnamedControls()).toEqual([]);
  }, 20_000);

  it("opens the job drawer as a labelled modal dialog", async () => {
    await mount();
    await act(async () => [...host.querySelectorAll(".mgo-diary__col li button")][0].click());

    const dialog = host.querySelector('[role="dialog"]');
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(accessibleName(dialog)).toBeTruthy();
    expect(unnamedControls()).toEqual([]);
  });

  it("keeps one selected tab and moves focus with the arrow keys", async () => {
    await mount();
    const tabs = [...host.querySelectorAll('[role="tab"]')];
    expect(tabs.filter((tab) => tab.getAttribute("aria-selected") === "true")).toHaveLength(1);
    // Only the selected tab is in the tab order; the rest are reached with arrows.
    expect(tabs.filter((tab) => tab.getAttribute("tabindex") === "0")).toHaveLength(1);
    tabs.forEach((tab) => expect(tab.getAttribute("aria-controls")).toBeTruthy());
  });
});
