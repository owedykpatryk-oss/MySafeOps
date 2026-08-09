/** @vitest-environment jsdom */
/**
 * Behavioural cover for the management overview: the module is large and mostly derived
 * state, so these tests drive the real component tree rather than the helpers alone.
 */
import { createElement, StrictMode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// The management overview is admin-only. Outside a real cloud session the app context
// resolves every visitor to "operative", so the role is stubbed to exercise the module.
vi.mock("../context/AppContext", () => ({
  useApp: () => ({ role: "admin", isPlatformOwner: false }),
}));

import ManagementOverview from "./ManagementOverview";
import { SupabaseAuthProvider } from "../context/SupabaseAuthContext";
import { ToastProvider } from "../context/ToastContext";
import { addDays, isoDate, saveManagementState } from "../utils/managementOverview";
import { saveOrgScoped } from "../utils/orgStorage";

const TEAM = { id: "team_a", name: "North Team", colour: "#0f766e", capacity: 5, region: "North" };

function relative(days) {
  return isoDate(addDays(new Date(), days));
}

const WORKERS = [
  { id: "w1", name: "Sam Fitter", role: "Groundworker" },
  { id: "w2", name: "Ola Nowak", role: "Supervisor" },
];

function seedState({ crewed = false, values = false } = {}) {
  saveOrgScoped("mysafeops_workers", WORKERS);
  saveManagementState({
    teams: [{ ...TEAM, memberIds: crewed ? ["w1"] : [] }],
    jobs: {},
    opportunities: [
      // Running today, and clashing with the second job on the same team.
      { id: "live", name: "Manchester dig", client: "Acme", site: "M1", teamId: TEAM.id, start: relative(-2), end: relative(3), status: "confirmed", value: values ? 12000 : 0 },
      // Mobilising tomorrow with paperwork outstanding.
      { id: "clash", name: "Salford dig", client: "Acme", site: "M5", teamId: TEAM.id, start: relative(1), end: relative(6), status: "provisional", value: values ? 5000 : 0, readiness: { dates: true, team: true, rams: false, permits: false, survey: true, client: true } },
      // Finished a week ago and never closed.
      { id: "late", name: "Bolton survey", client: "Beta", site: "BL1", teamId: TEAM.id, start: relative(-14), end: relative(-7), status: "confirmed" },
    ],
    meeting: {
      title: "Weekly management meeting",
      attendees: "",
      notes: "Discussed the Salford clash.",
      actions: [{ id: "act1", text: "Chase Salford permit", owner: "Jo", due: relative(2), status: "Open" }],
    },
  });
}

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
    root.render(createElement(StrictMode, null, createElement(Providers, null, createElement(ManagementOverview))));
  });
}

const text = () => host.textContent || "";
const all = (selector) => [...host.querySelectorAll(selector)];
const byText = (selector, needle) => all(selector).find((node) => (node.textContent || "").includes(needle));

async function click(node) {
  expect(node, "element to click").toBeTruthy();
  await act(async () => {
    node.click();
  });
}

/**
 * Scenario, calendar, meeting and group load on demand. Wait against a wall-clock deadline
 * rather than a fixed number of ticks: on a loaded machine a dynamic import can take far
 * longer than a handful of microtasks.
 */
async function waitFor(find, label = "element", timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const found = find();
    if (found) return found;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${label}`);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
  }
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
  seedState();
});

afterEach(async () => {
  if (root) await act(async () => root.unmount());
  host?.remove();
  root = null;
  host = null;
  document.body.innerHTML = "";
});

describe("management overview", () => {
  it("shows work that is running now and work that has run past its finish date", async () => {
    await mount();
    expect(text()).toContain("jobs on site today");
    expect(text()).toContain("On site now (1)");
    expect(text()).toContain("Manchester dig");
    expect(text()).toContain("Overdue since");
  });

  it("surfaces a double booking on the live programme", async () => {
    await mount();
    expect(text()).toContain("team scheduling conflict");
    expect(text()).toContain("North Team");
    // The conflict count is badged on the planner tab.
    expect(byText(".mgo-tabs button", "90-day planner")?.querySelector(".mgo-tabs__badge")?.textContent).toBe("1");
  });

  it("exposes the tabs as a keyboard-navigable tablist and keeps the view in the URL", async () => {
    await mount();
    const tabs = all('[role="tab"]');
    expect(tabs).toHaveLength(8);
    expect(tabs.filter((tab) => tab.getAttribute("aria-selected") === "true")).toHaveLength(1);

    await click(byText('[role="tab"]', "90-day planner"));
    expect(byText('[role="tab"]', "90-day planner").getAttribute("aria-selected")).toBe("true");
    expect(host.querySelector('[role="tabpanel"]').id).toBe("mgo-panel-planner");
  });

  it("filters the planner and reports how much is hidden", async () => {
    await mount();
    await click(byText('[role="tab"]', "90-day planner"));
    // The window opens on this week's Monday, so the job that finished last week is not in it.
    expect(all(".mgo-planner-row")).toHaveLength(2);

    const search = host.querySelector('.mgo-filters__search input');
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      setter.call(search, "salford");
      search.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(all(".mgo-planner-row")).toHaveLength(1);
    expect(text()).toContain("Showing 1 of 2 in window");
  });

  it("opens the job drawer and closes it on Escape", async () => {
    await mount();
    await click(byText(".mgo-diary__col--live li button", "Manchester dig"));
    expect(host.querySelector('[role="dialog"]')).toBeTruthy();
    expect(text()).toContain("Job readiness");

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(host.querySelector('[role="dialog"]')).toBeNull();
  });

  it("asks for confirmation before a team is removed", async () => {
    await mount();
    await click(byText('[role="tab"]', "Teams & capacity"));
    await click(host.querySelector('[aria-label="Remove North Team"]'));

    const dialog = document.querySelector('[role="alertdialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog.textContent).toContain("Jobs assigned to it will become unassigned");
  });

  it("lists what is mobilising and what is missing on it", async () => {
    await mount();
    const watch = host.querySelector(".mgo-mobilisation__list");
    expect(watch).toBeTruthy();
    expect(watch.textContent).toContain("Salford dig");
    expect(watch.textContent).toContain("Tomorrow");
    expect(watch.textContent).toContain("RAMS");
    expect(watch.textContent).toContain("Permits");
    // Nobody is rostered to North Team, so the crew gap is flagged too.
    expect(watch.textContent).toContain("Crew");
  });

  it("hides the value strip until contract values are recorded", async () => {
    await mount();
    expect(host.querySelector(".mgo-value-strip")).toBeNull();

    await act(async () => root.unmount());
    host.remove();
    seedState({ values: true });
    await mount();

    const strip = host.querySelector(".mgo-value-strip");
    expect(strip).toBeTruthy();
    expect(strip.textContent).toContain("£12,000");
    expect(strip.textContent).toContain("Pipeline");
  });

  it("rosters a worker into a crew and clears the empty-crew warning", async () => {
    await mount();
    await click(byText('[role="tab"]', "Teams & capacity"));
    expect(text()).toContain("work booked but nobody rostered");
    expect(text()).toContain("No crew rostered");

    const checkbox = [...host.querySelectorAll(".mgo-crew__list input")][0];
    await click(checkbox);

    expect(text()).toContain("1 crew member");
    expect(text()).not.toContain("work booked but nobody rostered");
  });

  it("reschedules a job from the keyboard without opening a form", async () => {
    await mount();
    await click(byText('[role="tab"]', "90-day planner"));

    const row = byText(".mgo-planner-row", "Salford dig");
    const startBefore = relative(1);
    await act(async () => {
      row.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    });

    // The move is offered back before it is forgotten.
    expect(host.querySelector(".mgo-undo").textContent).toContain("Moving Salford dig");

    await click(byText(".mgo-planner-row", "Salford dig"));
    const start = host.querySelector('.mgo-drawer__grid input[type="date"]');
    expect(start.value).toBe(relative(2));
    expect(start.value).not.toBe(startBefore);
  });

  it("moves a job by a week with Shift and puts it back on undo", async () => {
    await mount();
    await click(byText('[role="tab"]', "90-day planner"));

    await act(async () => {
      byText(".mgo-planner-row", "Salford dig").dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", shiftKey: true, bubbles: true }),
      );
    });
    await click(byText(".mgo-planner-row", "Salford dig"));
    expect(host.querySelector('.mgo-drawer__grid input[type="date"]').value).toBe(relative(8));

    await click(host.querySelector('[aria-label="Close job editor"]'));
    await click(byText(".mgo-undo button", "Undo"));
    await click(byText(".mgo-planner-row", "Salford dig"));
    expect(host.querySelector('.mgo-drawer__grid input[type="date"]').value).toBe(relative(1));
  });

  it("reschedules by dragging the bar and swallows the click that ends the drag", async () => {
    await mount();
    await click(byText('[role="tab"]', "90-day planner"));

    const bar = byText(".mgo-job-bar", "Salford dig");
    const track = bar.closest(".mgo-planner-row__track");
    // jsdom has no layout, so the track has to be told how wide it is: 13 weeks over 910px
    // is exactly 10px per day.
    track.getBoundingClientRect = () => ({ width: 910, height: 62, top: 0, left: 0, right: 910, bottom: 62, x: 0, y: 0, toJSON() {} });
    // React listens for native pointer events; jsdom has no PointerEvent, and a MouseEvent
    // carries the clientX/button the handler actually reads.
    const pointer = (type, clientX) => new MouseEvent(type, { bubbles: true, cancelable: true, clientX, button: 0 });

    await act(async () => bar.dispatchEvent(pointer("pointerdown", 100)));
    await act(async () => bar.dispatchEvent(pointer("pointermove", 130)));
    await act(async () => bar.dispatchEvent(pointer("pointerup", 130)));

    expect(host.querySelector(".mgo-undo").textContent).toContain("Moving Salford dig");

    const row = byText(".mgo-planner-row", "Salford dig");
    await click(row); // swallowed: this is the click that ends the drag
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    await click(row);
    expect(host.querySelector('.mgo-drawer__grid input[type="date"]').value).toBe(relative(4));
  });

  it("records who moved a job and shows it in the change log", async () => {
    await mount();
    await click(byText('[role="tab"]', "90-day planner"));
    await act(async () => {
      byText(".mgo-planner-row", "Salford dig").dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    });
    await click(byText(".mgo-planner-row", "Salford dig"));

    const log = host.querySelector(".mgo-drawer__history");
    expect(log).toBeTruthy();
    expect(log.textContent).toContain("Start date");
    expect(log.textContent).toContain("just now");
    // Dates read as dates, not as raw ISO strings.
    expect(log.textContent).not.toContain(relative(2));

    // Ticking a readiness box is not a scheduling decision and stays out of the log.
    const before = log.querySelectorAll("li").length;
    await click(host.querySelector('.mgo-checklist input[type="checkbox"]'));
    expect(host.querySelectorAll(".mgo-drawer__history li")).toHaveLength(before);
  });

  it("mounts every on-demand tab", async () => {
    await mount();

    await click(byText('[role="tab"]', "Scenario planner"));
    await waitFor(() => (text().includes("What if we move this job?") ? true : null), "scenario tab");
    expect(host.querySelector(".mgo-scenario__capacity")).toBeTruthy();

    await click(byText('[role="tab"]', "Calendar sync"));
    await waitFor(() => host.querySelector(".mgo-calendar-hub"), "calendar tab");
    expect(text()).toContain("Your programme, grouped under MySafeOps");
    expect(text()).toContain("Export MySafeOps calendar");

    await click(byText('[role="tab"]', "All countries"));
    await waitFor(() => host.querySelector(".mgo-group"), "group tab");
    expect(text()).toContain("All countries");

    await click(byText('[role="tab"]', "Clients"));
    await waitFor(() => host.querySelector(".mgo-clients"), "clients tab");
    expect(text()).toContain("Acme");
  });

  it("groups the programme by client and opens a job from there", async () => {
    seedState({ values: true });
    await mount();

    await click(byText('[role="tab"]', "Clients"));
    const clients = await waitFor(() => host.querySelector(".mgo-clients"), "clients tab");

    // Two seeded clients: Acme (two jobs) and Beta (the overdue survey).
    expect(clients.querySelectorAll(".mgo-clients__card")).toHaveLength(2);
    const acme = byText(".mgo-clients__card", "Acme");
    expect(acme.textContent).toContain("2 jobs");
    expect(acme.textContent).toContain("on site");
    expect(acme.textContent).toContain("£17,000");

    await click(acme.querySelector(".mgo-clients__jobs button"));
    expect(host.querySelector("#mgo-job-title")).toBeTruthy();
  });

  it("offers a way back after a destructive change", async () => {
    await mount();
    await click(byText(".mgo-diary__col li button", "Salford dig"));
    await click(byText(".mgo-drawer button", "Remove opportunity"));

    const undo = host.querySelector(".mgo-undo");
    expect(undo).toBeTruthy();
    expect(undo.textContent).toContain("Removing Salford dig");
    // Gone from the programme itself — the undo bar still names it, which is the point.
    expect(host.querySelector(".mgo-diary").textContent).not.toContain("Salford dig");

    await click(byText(".mgo-undo button", "Undo"));
    expect(host.querySelector(".mgo-undo")).toBeNull();
    expect(host.querySelector(".mgo-diary").textContent).toContain("Salford dig");
  });

  it("books a team out and reflects it in the capacity forecast", async () => {
    await mount();
    await click(byText('[role="tab"]', "Teams & capacity"));

    const form = host.querySelector(".mgo-daysoff__form");
    const setValue = (input, value) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      setter.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    };
    await act(async () => {
      setValue(form.querySelector('[name="label"]'), "Shutdown");
      setValue(form.querySelector('[name="from"]'), relative(20));
      setValue(form.querySelector('[name="to"]'), relative(24));
    });
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(text()).toContain("1 period off");
    expect(host.querySelector(".mgo-daysoff__list").textContent).toContain("Shutdown");
    expect(host.querySelector(".mgo-capacity-detail").textContent).toContain("off");
  });

  it("shows the market's public holidays against each crew and lets one opt out", async () => {
    await mount();
    await click(byText('[role="tab"]', "Teams & capacity"));

    const daysOff = host.querySelector(".mgo-daysoff");
    expect(daysOff.textContent).toMatch(/public holiday/i);

    const toggle = host.querySelector(".mgo-daysoff__toggle input");
    expect(toggle.checked).toBe(false);
    await click(toggle);
    expect(host.querySelector(".mgo-daysoff").textContent).toContain("works public holidays");
    // Opting out removes the read-only holiday rows from the crew's calendar.
    expect(host.querySelectorAll(".mgo-daysoff__list li.is-holiday")).toHaveLength(0);
  });

  it("steps through the programme from inside the drawer", async () => {
    await mount();
    await click(byText(".mgo-diary__col--live li button", "Manchester dig"));
    const nav = host.querySelector(".mgo-drawer__nav");
    expect(nav.textContent).toContain("of 3");

    await click(host.querySelector('[aria-label="Next job"]'));
    expect(host.querySelector("#mgo-job-title").textContent).not.toBe("Manchester dig");
  });

  it("archives a meeting and carries its open actions forward", async () => {
    await mount();
    await click(byText('[role="tab"]', "Meeting mode"));
    const archiveButton = await waitFor(() => byText(".mgo-meeting__hero-buttons button", "Close & archive"), "meeting tab");
    await click(archiveButton);

    expect(text()).toContain("Meeting history (1)");
    // The open action survives into the fresh meeting.
    await click(byText(".mgo-meeting__agenda button", "Actions agreed"));
    expect(host.querySelector(".mgo-actions__list").textContent).toContain("Chase Salford permit");
  });
});
