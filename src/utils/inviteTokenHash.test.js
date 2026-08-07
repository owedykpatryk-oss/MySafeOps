import { describe, expect, it } from "vitest";
import {
  hashInviteToken,
  renewedInviteExpiry,
  shouldRotateInviteToken,
} from "../../supabase/functions/_shared/inviteTokenHash.ts";

describe("hashInviteToken", () => {
  it("matches PostgreSQL pgcrypto SHA-256 hex output", async () => {
    await expect(hashInviteToken("invite-token-123")).resolves.toBe(
      "21164a321e1b7b5e51da333b287186674bcb714e12827b4ade04a6848d1d279c"
    );
  });

  it("rotates previously sent, missing, or expired links", () => {
    const now = Date.parse("2026-07-31T12:00:00.000Z");
    expect(shouldRotateInviteToken({ token: "live", expiresAt: "2026-08-01T00:00:00.000Z" }, now)).toBe(false);
    expect(shouldRotateInviteToken({ token: "live", expiresAt: "2026-08-01T00:00:00.000Z", sentAt: "sent" }, now)).toBe(
      true
    );
    expect(shouldRotateInviteToken({ token: "", expiresAt: "2026-08-01T00:00:00.000Z" }, now)).toBe(true);
    expect(shouldRotateInviteToken({ token: "live", expiresAt: "2026-07-30T00:00:00.000Z" }, now)).toBe(true);
    expect(renewedInviteExpiry(now)).toBe("2026-08-14T12:00:00.000Z");
  });
});
