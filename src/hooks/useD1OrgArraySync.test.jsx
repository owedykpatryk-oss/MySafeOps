/** @vitest-environment jsdom */
import { act, useLayoutEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  save: vi.fn(() => true),
  peek: vi.fn(async () => null),
  remove: vi.fn(async () => true),
  archive: vi.fn(async () => {}),
  hasRecovery: vi.fn(async () => false),
  tryFlush: vi.fn(async () => "empty"),
  enqueue: vi.fn(async () => {}),
  org: "org_x",
  country: null,
  load: vi.fn((_key, fallback) => fallback),
}));

vi.mock("../lib/d1SyncClient", () => ({
  d1GetKv: mocks.get,
  d1PutKv: mocks.put,
  isD1Configured: () => true,
  isD1RateLimitedError: () => false,
  isD1TransientError: () => false,
}));
vi.mock("../lib/supabase", () => ({ supabase: {} }));
vi.mock("../utils/orgStorage", () => ({ getOrgId: () => mocks.org, ORG_CHANGED_EVENT: "mysafeops-org-changed" }));
vi.mock("../lib/d1WriteForbidden.js", () => ({
  clearD1WriteForbidden: () => {},
  isForbiddenD1Write: () => false,
  notifyD1WriteForbidden: () => {},
}));
vi.mock("../lib/d1SyncOutbox.js", () => ({
  d1OutboxDelete: mocks.remove,
  d1OutboxPeek: mocks.peek,
  d1OutboxArchiveConflict: mocks.archive,
  d1OutboxHasRecovery: mocks.hasRecovery,
  d1OutboxEnqueue: mocks.enqueue,
  d1OutboxHasPending: async () => false,
  d1OutboxTryFlush: mocks.tryFlush,
}));
vi.mock("../utils/countryWorkspaces.js", () => ({
  getCachedActiveCountryWorkspace: () => mocks.country,
  COUNTRY_WORKSPACE_CHANGED_EVENT: "country-changed",
}));

const { useD1OrgArraySync } = await import("./useD1OrgArraySync");

/** Mirrors how modules used to call the hook: fresh closures and a fresh array on every render. */
function Harness({ onRender, expose, onLayout }) {
  const [rows, setRows] = useState([]);
  onRender(rows);
  expose?.(setRows);
  useLayoutEffect(() => onLayout?.(rows), [rows, onLayout]);
  useD1OrgArraySync({
    storageKey: "geo_photos",
    namespace: "geo_photos",
    value: rows,
    setValue: (next) => setRows(Array.isArray(next) ? [...next] : []),
    load: mocks.load,
    save: mocks.save,
    debounceMs: 5,
  });
  return null;
}

async function flush(ms = 60) {
  await act(async () => {
    await new Promise((res) => setTimeout(res, ms));
  });
}

describe("useD1OrgArraySync", () => {
  beforeEach(() => {
    mocks.org = "org_x";
    mocks.country = null;
    mocks.load.mockReset().mockImplementation((_key, fallback) => fallback);
    mocks.save.mockReset().mockReturnValue(true);
    mocks.peek.mockReset().mockResolvedValue(null);
    mocks.remove.mockReset().mockResolvedValue(true);
    mocks.archive.mockReset().mockResolvedValue(undefined);
    mocks.hasRecovery.mockReset().mockResolvedValue(false);
    mocks.tryFlush.mockReset().mockResolvedValue("empty");
    mocks.enqueue.mockReset().mockResolvedValue(undefined);
    mocks.get.mockReset();
    mocks.put.mockReset();
    mocks.get.mockResolvedValue({
      ok: true,
      version: 3,
      value: [{ id: "a", updatedAt: "2026-08-12T09:00:00Z" }],
    });
    mocks.put.mockResolvedValue({ ok: true, version: 4 });
  });

  it("persists locally before any debounce so immediate export/backgrounding sees the rows", async () => {
    const root = createRoot(document.createElement("div"));
    await act(async () => root.render(<Harness onRender={() => {}} />));
    expect(mocks.save).toHaveBeenCalledWith("geo_photos", [{ id: "a", updatedAt: "2026-08-12T09:00:00Z" }]);
    act(() => root.unmount());
  });

  it.each(["organisation", "country"])("does not write an old render into the new %s after a layout-time scope switch", async (kind) => {
    let edit;
    const saves = [];
    const root = createRoot(document.createElement("div"));
    let switched = false;
    const onLayout = (rows) => {
      if (rows[0]?.id !== "old-edit" || switched) return;
      switched = true;
      if (kind === "organisation") mocks.org = "org_y";
      else mocks.country = { id: "pl", is_primary: false };
      window.dispatchEvent(new Event(kind === "organisation" ? "mysafeops-org-changed" : "country-changed"));
    };
    mocks.save.mockImplementation((_key, rows) => {
      saves.push({ org: mocks.org, country: mocks.country?.id || null, rows });
      return true;
    });
    mocks.load.mockImplementation(() => switched ? [{ id: "new-workspace" }] : []);
    try {
      await act(async () => root.render(<Harness onRender={() => {}} expose={(set) => { edit = set; }} onLayout={onLayout} />));
      saves.length = 0;
      await act(async () => edit([{ id: "old-edit" }]));
      expect(saves.some((item) => (item.org === "org_y" || item.country === "pl") && item.rows[0]?.id === "old-edit")).toBe(false);
    } finally { act(() => root.unmount()); }
  });

  it("hydrates once even when the caller passes inline closures", async () => {
    const onRender = vi.fn();
    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () => {
      root.render(<Harness onRender={onRender} />);
    });
    await flush();

    expect(mocks.get).toHaveBeenCalledTimes(1);
    expect(onRender.mock.calls.length).toBeLessThan(6);

    act(() => root.unmount());
  });

  it("acknowledges only the queue snapshot captured before the direct upload", async () => {
    const receipt = { operationId: "old-queue-entry" };
    mocks.peek.mockResolvedValue(receipt);
    const root = createRoot(document.createElement("div"));
    try {
      await act(async () => root.render(<Harness onRender={() => {}} />));
      await flush();
      expect(mocks.remove).toHaveBeenCalledWith("org_x", "geo_photos", "main", receipt);
    } finally { act(() => root.unmount()); }
  });

  it("does not replace current edits when durable conflict recovery fails", async () => {
    let edit;
    let currentRows;
    const root = createRoot(document.createElement("div"));
    try {
      await act(async () => root.render(<Harness onRender={(rows) => { currentRows = rows; }} expose={(set) => { edit = set; }} />));
      await flush();
      mocks.put.mockResolvedValue({ ok: false, error: "version_conflict" });
      mocks.get.mockResolvedValue({ ok: true, version: 8, value: [{ id: "a", title: "remote", updatedAt: "2030-01-01" }] });
      mocks.archive.mockRejectedValue(new Error("storage unavailable"));
      const local = [{ id: "a", title: "local", updatedAt: "2026-01-01" }];
      await act(async () => edit(local));
      await flush();
      expect(mocks.archive).toHaveBeenCalled();
      expect(currentRows).toEqual(local);
    } finally { act(() => root.unmount()); }
  });

  it("preserves local edits after a saved version conflict", async () => {
    let edit;
    let currentRows;
    const root = createRoot(document.createElement("div"));
    try {
      await act(async () => root.render(<Harness onRender={(rows) => { currentRows = rows; }} expose={(set) => { edit = set; }} />));
      await flush();
      mocks.put.mockResolvedValue({ ok: false, error: "version_conflict" });
      mocks.get.mockResolvedValue({ ok: true, version: 8, value: [{ id: "a", title: "remote", updatedAt: "2030-01-01" }] });
      const local = [{ id: "a", title: "local", updatedAt: "2026-01-01" }];
      await act(async () => edit(local));
      await flush();
      expect(mocks.archive).toHaveBeenCalled();
      expect(currentRows).toEqual(local);
      expect(mocks.save).not.toHaveBeenCalledWith("geo_photos", [{ id: "a", title: "remote", updatedAt: "2030-01-01" }]);
      await act(async () => edit([{ id: "a", title: "another local edit" }]));
      await flush();
      expect(mocks.put).toHaveBeenCalledTimes(2);
    } finally { act(() => root.unmount()); }
  });

  it("keeps an unresolved local conflict through hydration without overwriting cloud data", async () => {
    const local = [{ id: "a", title: "local", updatedAt: "2026-01-01" }];
    mocks.load.mockReturnValue(local);
    mocks.hasRecovery.mockResolvedValue(true);
    mocks.get.mockResolvedValue({ ok: true, version: 8, value: [{ id: "a", title: "remote", updatedAt: "2030-01-01" }] });
    let currentRows;
    let edit;
    const root = createRoot(document.createElement("div"));
    try {
      await act(async () => root.render(<Harness onRender={(rows) => { currentRows = rows; }} expose={(set) => { edit = set; }} />));
      await flush();
      expect(currentRows).toEqual(local);
      await act(async () => edit([{ id: "a", title: "more local work" }]));
      await flush();
      expect(mocks.put).not.toHaveBeenCalled();
      expect(mocks.tryFlush).not.toHaveBeenCalled();
    } finally { act(() => root.unmount()); }
  });

  it("keeps a pending local upload visible while its version is checked", async () => {
    const local = [{ id: "a", title: "pending", updatedAt: "2026-01-01" }];
    mocks.load.mockReturnValue(local);
    mocks.peek.mockResolvedValue({ value: local, clientVersion: 3 });
    mocks.get.mockResolvedValue({ ok: true, version: 8, value: [{ id: "a", title: "remote", updatedAt: "2030-01-01" }] });
    mocks.tryFlush.mockResolvedValue("conflict_saved");
    let currentRows;
    const root = createRoot(document.createElement("div"));
    try {
      await act(async () => root.render(<Harness onRender={(rows) => { currentRows = rows; }} />));
      await flush();
      expect(currentRows).toEqual(local);
      expect(mocks.tryFlush).toHaveBeenCalledTimes(1);
      expect(mocks.put).not.toHaveBeenCalled();
    } finally { act(() => root.unmount()); }
  });

  it("ignores an older failed request after a newer edit has already saved", async () => {
    let edit;
    let finishOld;
    const root = createRoot(document.createElement("div"));
    try {
      await act(async () => root.render(<Harness onRender={() => {}} expose={(set) => { edit = set; }} />));
      await flush();
      mocks.put.mockImplementationOnce(() => new Promise((resolve) => { finishOld = resolve; }));
      await act(async () => edit([{ id: "a", title: "older" }]));
      await flush();
      await act(async () => edit([{ id: "a", title: "newer" }]));
      await flush();
      await act(async () => finishOld({ ok: false, error: "http_500" }));
      expect(mocks.enqueue).not.toHaveBeenCalled();
    } finally { act(() => root.unmount()); }
  });

  it.each(["organisation", "country"])("ignores hydration completed after a %s switch before React cleanup", async (kind) => {
    let finishGet;
    mocks.get.mockImplementationOnce(() => new Promise((resolve) => { finishGet = resolve; }));
    const root = createRoot(document.createElement("div"));
    try {
      await act(async () => root.render(<Harness onRender={() => {}} />));
      mocks.save.mockClear();
      await act(async () => {
        if (kind === "organisation") mocks.org = "org_y";
        else mocks.country = { id: "pl", is_primary: false };
        // The cache can change before the previous effect is cleaned up.
        finishGet({ ok: true, version: 90, value: [{ id: "old-workspace" }] });
        await Promise.resolve();
      });
      expect(mocks.save).not.toHaveBeenCalled();
      expect(mocks.put).not.toHaveBeenCalled();
    } finally { act(() => root.unmount()); }
  });

  it("reloads local rows and hydrates the new country without waiting for a page reload", async () => {
    let currentRows;
    const root = createRoot(document.createElement("div"));
    try {
      await act(async () => root.render(<Harness onRender={(rows) => { currentRows = rows; }} />));
      await flush();
      const countryRows = [{ id: "poland-local" }];
      mocks.load.mockReturnValue(countryRows);
      mocks.get.mockImplementationOnce(() => new Promise(() => {}));
      mocks.put.mockClear();
      await act(async () => {
        mocks.country = { id: "pl", is_primary: false };
        window.dispatchEvent(new Event("country-changed"));
      });
      await flush();
      expect(currentRows).toEqual(countryRows);
      expect(mocks.get).toHaveBeenLastCalledWith({}, "org_x", "geo_photos", "country:pl:main");
      expect(mocks.put).not.toHaveBeenCalled();
    } finally { act(() => root.unmount()); }
  });

  it("does not apply an old initial-upload version to the next organisation", async () => {
    let finishSeed;
    const root = createRoot(document.createElement("div"));
    mocks.load.mockReturnValue([{ id: "local" }]);
    mocks.get.mockResolvedValueOnce({ ok: true, version: 0, value: null });
    mocks.put.mockImplementationOnce(() => new Promise((resolve) => { finishSeed = resolve; }));
    try {
      await act(async () => root.render(<Harness onRender={() => {}} />));
      await act(async () => {
        mocks.org = "org_y";
        window.dispatchEvent(new Event("mysafeops-org-changed"));
      });
      await act(async () => finishSeed({ ok: true, version: 99 }));
      await flush();
      expect(mocks.put).toHaveBeenLastCalledWith({}, "org_y", "geo_photos", "main", expect.any(Array), 3);
    } finally { act(() => root.unmount()); }
  });

  it("does not retry an old hydration after the country changes during backoff", async () => {
    vi.useFakeTimers();
    const root = createRoot(document.createElement("div"));
    mocks.get.mockResolvedValueOnce({ ok: false, error: "fetch_failed" });
    try {
      await act(async () => root.render(<Harness onRender={() => {}} />));
      mocks.country = { id: "pl", is_primary: false };
      await act(async () => vi.advanceTimersByTimeAsync(5000));
      expect(mocks.get).toHaveBeenCalledTimes(1);
      expect(mocks.put).not.toHaveBeenCalled();
    } finally { act(() => root.unmount()); vi.useRealTimers(); }
  });

  it("keeps edits when country metadata changes without changing its data scope", async () => {
    let edit;
    let currentRows;
    const root = createRoot(document.createElement("div"));
    try {
      await act(async () => root.render(<Harness onRender={(rows) => { currentRows = rows; }} expose={(set) => { edit = set; }} />));
      const local = [{ id: "draft" }];
      await act(async () => edit(local));
      mocks.load.mockClear();
      await act(async () => {
        mocks.country = { id: "uk", is_primary: true, display_name: "Updated name" };
        window.dispatchEvent(new Event("country-changed"));
      });
      expect(currentRows).toEqual(local);
      expect(mocks.get).toHaveBeenCalledTimes(1);
      expect(mocks.load).not.toHaveBeenCalled();
    } finally { act(() => root.unmount()); }
  });
});
