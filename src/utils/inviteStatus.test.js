import { describe, expect, it } from "vitest";
import { formatInviteExpiryEnGb, getEffectiveInviteStatus } from "./inviteStatus";

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

describe("formatInviteExpiryEnGb", () => {
  it("prints Barnes join-link calendar days in en-GB from UTC, not the runtime timezone", () => {
    expect(formatInviteExpiryEnGb("2028-07-31T23:59:59.000Z")).toBe("31/07/2028");
    expect(formatInviteExpiryEnGb("2026-10-31T23:59:59.000Z")).toBe("31/10/2026");
    expect(formatInviteExpiryEnGb("not-a-date")).toBe("");
  });
});
