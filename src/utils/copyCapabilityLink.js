/**
 * Copy a capability / share URL and surface an honest security toast.
 * Local-only tokens (RAMS share, subcontractor, QR) only work in the same browser profile.
 */
import { copyTextToClipboard } from "./copyToClipboard";

export const SHARE_LINK_LOCAL_ONLY =
  "Link copied. It only works in this browser profile (same saved data). Anyone with the link can open it here — treat it like a password.";

export const SHARE_LINK_CLOUD =
  "Link copied. Recipients can open it on any device until expiry or you revoke/deactivate it.";

/**
 * @param {string} text
 * @param {{ pushToast?: (t: { type: string, message: string, title?: string }) => void, localOnly?: boolean, cloudPublished?: boolean }} [opts]
 * @returns {Promise<boolean>}
 */
export async function copyCapabilityLink(text, opts = {}) {
  const { pushToast, localOnly = true, cloudPublished = false } = opts;
  const ok = await copyTextToClipboard(text);
  if (!pushToast) return ok;
  if (!ok) {
    pushToast({
      type: "error",
      message: "Could not copy — select the link and copy manually.",
    });
    return false;
  }
  if (cloudPublished || !localOnly) {
    pushToast({ type: "success", message: SHARE_LINK_CLOUD });
  } else {
    pushToast({ type: "warn", message: SHARE_LINK_LOCAL_ONLY });
  }
  return true;
}
