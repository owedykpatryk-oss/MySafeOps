/** @vitest-environment jsdom */
/**
 * The save path is the only place a management edit can be lost: it lands in localStorage
 * immediately but reaches the shared workspace asynchronously. These tests cover the retry
 * behaviour, because a silently stranded write looks identical to a saved one.
 */
import { createElement, useState } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const WORKSPACE_ID = "ws-1";

let updateResult;
let updateCalls;
let fakeSupabase;

vi.mock("../context/SupabaseAuthContext", () => ({
  useSupabaseAuth: () => ({ supabase: fakeSupabase, user: { id: "user-1" }, ready: true }),
}));

vi.mock("../utils/countryWorkspaces", () => ({
  COUNTRY_WORKSPACE_CHANGED_EVENT: "mysafeops-country-changed",
  getCachedActiveCountryWorkspace: () => ({ id: WORKSPACE_ID, is_primary: true }),
}));

const { useManagementWorkspaceSync } = await import("./useManagementWorkspaceSync");

function row(overrides = {}) {
  return {
    org_id: "org-1",
    workspace_id: WORKSPACE_ID,
    state: { teams: [{ id: "a", name: "North", capacity: 5 }], jobs: {}, opportunities: [] },
    version: 3,
    updated_at: "2026-08-05T09:00:00Z",
    updated_by: "user-2",
    ...overrides,
  };
}

/** Minimal chainable stand-in for the parts of the Supabase client this hook touches. */
function makeSupabase() {
  const workspaceRow = row();
  return {
    from(table) {
      if (table === "organizations") {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "org-1" }, error: null }) }) }) };
      }
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: workspaceRow, error: null }) }) }),
        insert: () => ({ select: () => ({ maybeSingle: async () => ({ data: workspaceRow, error: null }) }) }),
        update: (payload) => ({
          eq: () => ({
            eq: () => ({
              select: () => ({
                maybeSingle: async () => {
                  updateCalls.push(payload);
                  return updateResult();
                },
              }),
            }),
          }),
        }),
      };
    },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: () => {},
  };
}

function Harness({ onStatus }) {
  const [state, setState] = useState({ teams: [{ id: "a", name: "North", capacity: 5 }], jobs: {}, opportunities: [] });
  const status = useManagementWorkspaceSync({ enabled: true, state, setState });
  onStatus(status, setState);
  return null;
}

let host;
let root;
let latest;

async function mount() {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root.render(createElement(Harness, { onStatus: (status, setState) => { latest = { status, setState }; } }));
  });
  // Let the initialise() promise chain settle.
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("mysafeops_orgId", "acme");
  updateCalls = [];
  updateResult = () => ({ data: row({ version: 4 }), error: null });
  fakeSupabase = makeSupabase();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(async () => {
  if (root) await act(async () => root.unmount());
  host?.remove();
  root = null;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("management workspace sync", () => {
  it("loads the shared workspace and reports it as synced", async () => {
    await mount();
    expect(latest.status.phase).toBe("synced");
    expect(latest.status.updatedBy).toBe("user-2");
    expect(latest.status.currentUserId).toBe("user-1");
  });

  it("does not write when the change makes no difference to the stored document", async () => {
    await mount();

    await act(async () => {
      // Trailing whitespace is trimmed away by validation, so the document is unchanged.
      latest.setState((current) => ({ ...current, teams: [{ ...current.teams[0], name: "North  " }] }));
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });

    expect(updateCalls).toHaveLength(0);
    expect(latest.status.phase).toBe("synced");
  });

  it("retries a failed save with backoff instead of stranding the change", async () => {
    await mount();
    updateResult = () => ({ data: null, error: { message: "Network error" } });

    await act(async () => {
      latest.setState((current) => ({ ...current, opportunities: [{ id: "o1", name: "New lead" }] }));
    });
    // Debounce before the first attempt.
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });

    expect(updateCalls).toHaveLength(1);
    expect(latest.status.phase).toBe("error");
    expect(latest.status.message).toContain("unsaved, retrying (1)");

    // First backoff step: 2s.
    await act(async () => { await vi.advanceTimersByTimeAsync(2100); });
    expect(updateCalls).toHaveLength(2);
    expect(latest.status.message).toContain("retrying (2)");

    // Once the network comes back the pending write lands and the state clears.
    updateResult = () => ({ data: row({ version: 5 }), error: null });
    await act(async () => { await vi.advanceTimersByTimeAsync(4100); });
    expect(updateCalls).toHaveLength(3);
    expect(latest.status.phase).toBe("synced");
  });

  it("retries immediately when the browser comes back online", async () => {
    await mount();
    updateResult = () => ({ data: null, error: { message: "Network error" } });

    await act(async () => {
      latest.setState((current) => ({ ...current, opportunities: [{ id: "o1", name: "New lead" }] }));
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(updateCalls).toHaveLength(1);

    updateResult = () => ({ data: row({ version: 5 }), error: null });
    await act(async () => {
      window.dispatchEvent(new Event("online"));
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(updateCalls).toHaveLength(2);
    expect(latest.status.phase).toBe("synced");
  });

  it("says so when the device is offline rather than claiming a failure", async () => {
    await mount();
    const onLine = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);

    await act(async () => {
      latest.setState((current) => ({ ...current, opportunities: [{ id: "o1", name: "New lead" }] }));
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });

    expect(updateCalls).toHaveLength(0);
    expect(latest.status.message).toContain("Offline");
    onLine.mockRestore();
  });
});
