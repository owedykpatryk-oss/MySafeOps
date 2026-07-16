/** @vitest-environment jsdom */
import { describe, expect, it, beforeEach } from "vitest";
import {
  LOCAL_WORKSPACE_FLAG,
  clearLocalWorkspaceOnlyFlag,
  hasPersistedSupabaseSession,
  isLocalWorkspaceOnly,
  setLocalWorkspaceOnly,
} from "./authPrefs.js";

describe("authPrefs", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("tracks local-only workspace flag", () => {
    expect(isLocalWorkspaceOnly()).toBe(false);
    setLocalWorkspaceOnly(true);
    expect(isLocalWorkspaceOnly()).toBe(true);
    setLocalWorkspaceOnly(false);
    expect(isLocalWorkspaceOnly()).toBe(false);
    expect(localStorage.getItem(LOCAL_WORKSPACE_FLAG)).toBeNull();
  });

  it("clears the legacy local-only flag", () => {
    setLocalWorkspaceOnly(true);
    clearLocalWorkspaceOnlyFlag();
    expect(isLocalWorkspaceOnly()).toBe(false);
  });

  it("detects persisted Supabase session token", () => {
    expect(hasPersistedSupabaseSession()).toBe(false);
    localStorage.setItem(
      "sb-test-auth-token",
      JSON.stringify({ access_token: "abc123", refresh_token: "xyz" })
    );
    expect(hasPersistedSupabaseSession()).toBe(true);
  });

  it("ignores malformed session storage", () => {
    localStorage.setItem("sb-test-auth-token", "not-json");
    expect(hasPersistedSupabaseSession()).toBe(false);
  });
});
