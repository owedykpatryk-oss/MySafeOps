/** @vitest-environment jsdom */
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  clearPasswordRecoveryPending,
  isPasswordRecoveryPending,
  markPasswordRecoveryPending,
  redirectToResetPasswordIfNeeded,
} from "./passwordRecovery.js";

describe("passwordRecovery", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  it("marks and clears the recovery flag", () => {
    expect(isPasswordRecoveryPending()).toBe(false);
    markPasswordRecoveryPending();
    expect(isPasswordRecoveryPending()).toBe(true);
    clearPasswordRecoveryPending();
    expect(isPasswordRecoveryPending()).toBe(false);
  });

  it("redirects away from landing to /reset-password", () => {
    const replace = vi.fn();
    vi.stubGlobal("location", {
      pathname: "/",
      search: "?code=abc",
      replace,
    });
    redirectToResetPasswordIfNeeded();
    expect(isPasswordRecoveryPending()).toBe(true);
    expect(replace).toHaveBeenCalledWith("/reset-password?code=abc");
  });

  it("does not redirect when already on /reset-password", () => {
    const replace = vi.fn();
    vi.stubGlobal("location", {
      pathname: "/reset-password",
      search: "",
      replace,
    });
    redirectToResetPasswordIfNeeded();
    expect(replace).not.toHaveBeenCalled();
  });
});
