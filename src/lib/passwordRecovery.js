/** Session flag so recovery links that land on Site URL (`/`) still reach /reset-password. */

const FLAG_KEY = "mso_password_recovery";

export function markPasswordRecoveryPending() {
  try {
    sessionStorage.setItem(FLAG_KEY, "1");
  } catch {
    /* private mode / blocked storage */
  }
}

export function clearPasswordRecoveryPending() {
  try {
    sessionStorage.removeItem(FLAG_KEY);
  } catch {
    /* ignore */
  }
}

export function isPasswordRecoveryPending() {
  try {
    return sessionStorage.getItem(FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

/** Navigate to the set-password page when recovery tokens create a session on the wrong route. */
export function redirectToResetPasswordIfNeeded() {
  if (typeof window === "undefined") return;
  const path = window.location.pathname || "";
  if (path === "/reset-password" || path.startsWith("/reset-password/")) return;
  markPasswordRecoveryPending();
  const next = `/reset-password${window.location.search || ""}`;
  window.location.replace(next);
}
