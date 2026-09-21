/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from "vitest";
import { buildInviteLoginPath, clearPendingInvite, peekPendingInvite, setPendingInviteToken } from "./inviteToken";

describe("inviteToken", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it("preserves invite details in an auth redirect path", () => {
    expect(buildInviteLoginPath({ token: "abc+123", email: " Worker@Example.com ", next: "/settings" })).toBe(
      "/login?invite=abc%2B123&email=worker%40example.com&next=%2Fsettings"
    );
  });

  it("stores invite capability only for the current browser session", () => {
    setPendingInviteToken("token-1", "Worker@Example.com");
    expect(peekPendingInvite()).toEqual({ token: "token-1", email: "worker@example.com" });
    expect(localStorage.getItem("mysafeops_pending_invite_token")).toBeNull();
    clearPendingInvite();
    expect(peekPendingInvite()).toBeNull();
  });
});
