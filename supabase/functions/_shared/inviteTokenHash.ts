export async function hashInviteToken(token: string): Promise<string> {
  const bytes = new TextEncoder().encode(String(token || ""));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function shouldRotateInviteToken(
  invite: { token?: string | null; expiresAt?: string | null; sentAt?: string | null },
  now = Date.now()
): boolean {
  const expiresAt = new Date(invite.expiresAt || "").getTime();
  return (
    !String(invite.token || "").trim() || Boolean(invite.sentAt) || !Number.isFinite(expiresAt) || expiresAt <= now
  );
}

export function renewedInviteExpiry(now = Date.now()): string {
  return new Date(now + 14 * 24 * 60 * 60 * 1000).toISOString();
}
