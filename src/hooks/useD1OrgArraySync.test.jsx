/** @vitest-environment jsdom */
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
}));

vi.mock("../lib/d1SyncClient", () => ({
  d1GetKv: mocks.get,
  d1PutKv: mocks.put,
  isD1Configured: () => true,
  isD1RateLimitedError: () => false,
  isD1TransientError: () => false,
}));
vi.mock("../lib/supabase", () => ({ supabase: {} }));
vi.mock("../utils/orgStorage", () => ({ getOrgId: () => "org_x", ORG_CHANGED_EVENT: "mysafeops-org-changed" }));
vi.mock("../lib/d1WriteForbidden.js", () => ({
  clearD1WriteForbidden: () => {},
  isForbiddenD1Write: () => false,
  notifyD1WriteForbidden: () => {},
}));
vi.mock("../lib/d1SyncOutbox.js", () => ({
  d1OutboxDelete: async () => {},
  d1OutboxEnqueue: async () => {},
  d1OutboxHasPending: async () => false,
  d1OutboxTryFlush: async () => {},
}));
vi.mock("../utils/countryWorkspaces.js", () => ({ getCachedActiveCountryWorkspace: () => null }));

const { useD1OrgArraySync } = await import("./useD1OrgArraySync");

/** Mirrors how modules used to call the hook: fresh closures and a fresh array on every render. */
function Harness({ onRender }) {
  const [rows, setRows] = useState([]);
  onRender();
  useD1OrgArraySync({
    storageKey: "geo_photos",
    namespace: "geo_photos",
    value: rows,
    setValue: (next) => setRows(Array.isArray(next) ? [...next] : []),
    load: (_key, fallback) => fallback,
    save: () => true,
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
    mocks.get.mockReset();
    mocks.put.mockReset();
    mocks.get.mockResolvedValue({
      ok: true,
      version: 3,
      value: [{ id: "a", updatedAt: "2026-08-12T09:00:00Z" }],
    });
    mocks.put.mockResolvedValue({ ok: true, version: 4 });
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

    root.unmount();
  });
});
