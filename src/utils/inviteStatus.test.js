import { describe, expect, it } from "vitest";
import { getEffectiveInviteStatus } from "./inviteStatus";

describe("getEffectiveInviteStatus", () => {
  const now = Date.parse("2026-07-31T12:00:00.000Z");

  it("marks a time-expired pending invite as expired", () => {
    expect(getEffectiveInviteStatus({ status: "pending", expires_at: "2026-07-30T12:00:00.000Z" }, now)).toBe(
      "expired"
    );
  });

  it("keeps future and terminal statuses unchanged", () => {
    expect(getEffectiveInviteStatus({ status: "pending", expires_at: "2026-08-01T12:00:00.000Z" }, now)).toBe(
      "pending"
    );
    expect(getEffectiveInviteStatus({ status: "revoked", expires_at: "2026-08-01T12:00:00.000Z" }, now)).toBe(
      "revoked"
    );
  });
});
