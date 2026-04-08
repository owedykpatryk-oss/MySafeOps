import { pushAudit } from "./auditLog";
import { setOrgId } from "./orgStorage";
import { clearPendingInvite, peekPendingInvite } from "../lib/inviteToken";

export async function ensureUserOrgContext(supabase) {
  if (!supabase) return null;
  const invite = peekPendingInvite();
  const args = {};
  if (invite?.token) args.p_invite_token = invite.token;
  const { data, error } = await supabase.rpc("ensure_my_org", args);
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.org_slug) throw new Error("No organisation returned by ensure_my_org.");

  setOrgId(row.org_slug);
  clearPendingInvite();
  if (row.trial_ends_at) {
    localStorage.setItem("mysafeops_trial_ends_at", String(row.trial_ends_at));
  }
  pushAudit({ action: "org_context_sync", entity: "org", detail: row.org_slug });
  return row;
}

export function getTrialStatus(now = Date.now()) {
  const raw = localStorage.getItem("mysafeops_trial_ends_at");
  if (!raw) return null;
  const endsAt = new Date(raw).getTime();
  if (!Number.isFinite(endsAt)) return null;
  const remainingMs = endsAt - now;
  const remainingDays = Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
  return {
    endsAtIso: new Date(endsAt).toISOString(),
    isActive: remainingMs > 0,
    remainingDays,
  };
}

