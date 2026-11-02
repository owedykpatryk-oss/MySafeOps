/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  signOut: vi.fn(async () => {}),
  navigate: vi.fn(),
  isGprEditorLocked: vi.fn(() => false),
}));

vi.mock("react-router-dom", () => ({ useNavigate: () => mocks.navigate }));
vi.mock("../context/SupabaseAuthContext", () => ({
  useSupabaseAuth: () => ({ user: { id: "user-a" }, supabase: { auth: { signOut: mocks.signOut } } }),
}));
vi.mock("../context/AppContext", () => ({ useApp: () => ({ role: "operative" }) }));
vi.mock("../lib/supabase", () => ({ isSupabaseConfigured: () => true }));
vi.mock("../lib/backupCrypto", () => ({ clearCloudBackupDek: vi.fn() }));
vi.mock("../utils/auditLog", () => ({ pushAudit: vi.fn() }));
vi.mock("../modules/gprReport/gprEditorSession.js", () => ({ isGprEditorLocked: mocks.isGprEditorLocked }));

import { IDLE_TIMEOUT_MS_DEFAULT, useIdleSessionLogout } from "./useIdleSessionLogout";

function SessionGuard() {
  useIdleSessionLogout();
  return null;
}

let root;
let host;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-08T10:00:00Z"));
  host = document.createElement("div");
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
});

describe("useIdleSessionLogout", () => {
  it("expires a session when the app returns after the idle limit", async () => {
    await act(async () => root.render(<SessionGuard />));
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    vi.setSystemTime(Date.now() + IDLE_TIMEOUT_MS_DEFAULT + 1000);
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });

    await act(async () => document.dispatchEvent(new Event("visibilitychange")));

    expect(mocks.signOut).toHaveBeenCalledTimes(1);
    expect(mocks.navigate).toHaveBeenCalledWith("/login?reason=idle", { replace: true });
  });

  it("does not let an editor lock revive an expired background session", async () => {
    mocks.isGprEditorLocked.mockReturnValue(true);
    await act(async () => root.render(<SessionGuard />));
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    vi.setSystemTime(Date.now() + IDLE_TIMEOUT_MS_DEFAULT + 1000);
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });

    await act(async () => document.dispatchEvent(new Event("visibilitychange")));

    expect(mocks.signOut).toHaveBeenCalledTimes(1);
  });
});
