const INVITE_TOKEN_KEY = "mysafeops_pending_invite_token";
const INVITE_EMAIL_KEY = "mysafeops_pending_invite_email";

export function setPendingInviteToken(token, email = "") {
  const t = String(token || "").trim();
  if (!t) return;
  localStorage.setItem(INVITE_TOKEN_KEY, t);
  if (email) localStorage.setItem(INVITE_EMAIL_KEY, String(email || "").trim().toLowerCase());
}

export function peekPendingInvite() {
  const token = localStorage.getItem(INVITE_TOKEN_KEY) || "";
  const email = localStorage.getItem(INVITE_EMAIL_KEY) || "";
  if (!token) return null;
  return { token, email };
}

export function clearPendingInvite() {
  localStorage.removeItem(INVITE_TOKEN_KEY);
  localStorage.removeItem(INVITE_EMAIL_KEY);
}

