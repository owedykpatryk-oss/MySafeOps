const INVITE_TOKEN_KEY = "mysafeops_pending_invite_token";
const INVITE_EMAIL_KEY = "mysafeops_pending_invite_email";

function inviteStore() {
  try {
    if (typeof sessionStorage !== "undefined") return sessionStorage;
  } catch {
    /* private mode */
  }
  try {
    if (typeof localStorage !== "undefined") return localStorage;
  } catch {
    /* ignore */
  }
  return null;
}

export function setPendingInviteToken(token, email = "") {
  const t = String(token || "").trim();
  if (!t) return;
  const store = inviteStore();
  if (!store) return;
  store.setItem(INVITE_TOKEN_KEY, t);
  const e = String(email || "").trim().toLowerCase();
  if (e) store.setItem(INVITE_EMAIL_KEY, e);
  else store.removeItem(INVITE_EMAIL_KEY);
  // Clear any legacy localStorage copy so tokens do not linger across sessions.
  try {
    if (store !== localStorage && typeof localStorage !== "undefined") {
      localStorage.removeItem(INVITE_TOKEN_KEY);
      localStorage.removeItem(INVITE_EMAIL_KEY);
    }
  } catch {
    /* ignore */
  }
}

export function peekPendingInvite() {
  const store = inviteStore();
  if (!store) return null;
  let token = store.getItem(INVITE_TOKEN_KEY) || "";
  let email = store.getItem(INVITE_EMAIL_KEY) || "";
  if (!token && typeof localStorage !== "undefined") {
    try {
      token = localStorage.getItem(INVITE_TOKEN_KEY) || "";
      email = localStorage.getItem(INVITE_EMAIL_KEY) || "";
      if (token) {
        setPendingInviteToken(token, email);
      }
    } catch {
      /* ignore */
    }
  }
  if (!token) return null;
  return { token, email };
}

export function clearPendingInvite() {
  try {
    sessionStorage?.removeItem(INVITE_TOKEN_KEY);
    sessionStorage?.removeItem(INVITE_EMAIL_KEY);
  } catch {
    /* ignore */
  }
  try {
    localStorage?.removeItem(INVITE_TOKEN_KEY);
    localStorage?.removeItem(INVITE_EMAIL_KEY);
  } catch {
    /* ignore */
  }
}
