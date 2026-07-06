/**
 * Ask Edge Function to sign out all sessions for an org member (admin only).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} targetUserId
 */
export async function revokeOrgMemberSessions(supabase, targetUserId) {
  if (!supabase || !targetUserId) return { ok: false, skipped: true };
  const { data, error } = await supabase.functions.invoke("revoke-org-member-sessions", {
    body: { targetUserId },
  });
  if (error) {
    if (String(error.message || "").includes("revoke-org-member-sessions")) {
      return { ok: false, skipped: true, reason: "function_not_deployed" };
    }
    throw error;
  }
  if (data?.error) {
    throw new Error(String(data.error));
  }
  return { ok: true };
}
