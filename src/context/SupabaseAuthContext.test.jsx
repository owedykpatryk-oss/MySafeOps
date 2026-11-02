/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  ensureUserOrgContext: vi.fn(async () => {}),
  event: null,
}));

vi.mock("../lib/supabase", () => ({
  supabase: { auth: { getSession: mocks.getSession, onAuthStateChange: mocks.onAuthStateChange } },
}));
vi.mock("../lib/authTelemetry", () => ({ trackAuthError: vi.fn(), trackAuthEvent: vi.fn() }));
vi.mock("../utils/sentryClient.js", () => ({ syncSentryUser: vi.fn() }));
vi.mock("../utils/orgMembership", () => ({ ensureUserOrgContext: mocks.ensureUserOrgContext }));
vi.mock("../utils/clientPortalAutoSync", () => ({ initPortalCloudAutoSync: vi.fn(() => () => {}) }));
vi.mock("../lib/passwordRecovery", () => ({
  isPasswordRecoveryPending: () => false,
  markPasswordRecoveryPending: vi.fn(),
  redirectToResetPasswordIfNeeded: vi.fn(),
}));
vi.mock("../utils/documentAuthorship.js", () => ({
  clearAuthorshipUserCache: vi.fn(),
  setAuthorshipUserCache: vi.fn(),
}));

import { SupabaseAuthProvider, useSupabaseAuth } from "./SupabaseAuthContext";

function SessionState() {
  const { ready, user } = useSupabaseAuth();
  return <span>{`${ready}:${user?.id || "none"}`}</span>;
}

let root;
let host;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.event = null;
  mocks.onAuthStateChange.mockImplementation((callback) => {
    mocks.event = callback;
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  });
  host = document.createElement("div");
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  vi.useRealTimers();
  host.remove();
});

describe("SupabaseAuthProvider bootstrap", () => {
  it("unblocks login when session lookup hangs and accepts a later auth event", async () => {
    mocks.getSession.mockReturnValue(new Promise(() => {}));
    vi.useFakeTimers();
    await act(async () => root.render(<SupabaseAuthProvider><SessionState /></SupabaseAuthProvider>));
    expect(host.textContent).toBe("false:none");

    await act(async () => vi.advanceTimersByTime(10_000));
    expect(host.textContent).toBe("true:none");

    await act(async () => mocks.event("SIGNED_IN", { user: { id: "late-user" } }));
    expect(host.textContent).toBe("true:late-user");
  });

  it("does not restore a stale session after sign-out", async () => {
    let resolveSession;
    mocks.getSession.mockReturnValue(new Promise((resolve) => { resolveSession = resolve; }));
    await act(async () => root.render(<SupabaseAuthProvider><SessionState /></SupabaseAuthProvider>));

    await act(async () => mocks.event("SIGNED_OUT", null));
    expect(host.textContent).toBe("true:none");

    await act(async () => resolveSession({ data: { session: { user: { id: "old-user" } } } }));
    expect(host.textContent).toBe("true:none");
    expect(mocks.ensureUserOrgContext).not.toHaveBeenCalled();
  });

  it("keeps a newer sign-in when the initial session lookup fails", async () => {
    let rejectSession;
    mocks.getSession.mockReturnValue(new Promise((_resolve, reject) => { rejectSession = reject; }));
    await act(async () => root.render(<SupabaseAuthProvider><SessionState /></SupabaseAuthProvider>));

    await act(async () => mocks.event("SIGNED_IN", { user: { id: "new-user" } }));
    expect(host.textContent).toBe("true:new-user");

    await act(async () => rejectSession(new Error("stale bootstrap error")));
    expect(host.textContent).toBe("true:new-user");
  });

  it("initializes organisation context when the auth event wins bootstrap", async () => {
    let resolveSession;
    mocks.getSession.mockReturnValue(new Promise((resolve) => { resolveSession = resolve; }));
    await act(async () => root.render(<SupabaseAuthProvider><SessionState /></SupabaseAuthProvider>));

    await act(async () => mocks.event("INITIAL_SESSION", { user: { id: "member" } }));
    await act(async () => resolveSession({ data: { session: { user: { id: "member" } } } }));

    expect(host.textContent).toBe("true:member");
    expect(mocks.ensureUserOrgContext).toHaveBeenCalledTimes(1);
  });
});
