/**
 * Supabase MFA: after first factor, session may be AAL1 until TOTP is verified.
 * @param {import("@supabase/supabase-js").SupabaseClient | null | undefined} client
 * @returns {Promise<{ needsMfa: boolean; error?: string }>}
 */
export async function getRequiresMfaStep(client) {
  const mfa = client?.auth?.mfa;
  if (!mfa?.getAuthenticatorAssuranceLevel) {
    return { needsMfa: false };
  }
  const { data, error } = await mfa.getAuthenticatorAssuranceLevel();
  if (error) {
    return { needsMfa: false, error: error.message };
  }
  if (!data) {
    return { needsMfa: false };
  }
  const { currentLevel, nextLevel } = data;
  return {
    needsMfa: nextLevel === "aal2" && currentLevel !== "aal2",
  };
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} client
 * @param {string} code
 */
export async function verifyTotpMfaLogin(client, code) {
  const mfa = client?.auth?.mfa;
  if (!mfa?.listFactors || !mfa.challenge || !mfa.verify) {
    return { error: "MFA is not available" };
  }
  const trimmed = String(code || "").replace(/\s/g, "");
  if (trimmed.length < 6) {
    return { error: "Enter the 6-digit code from your authenticator app." };
  }
  const { data: facs, error: lf } = await mfa.listFactors();
  if (lf) return { error: lf.message };
  const d = facs;
  const totp =
    (Array.isArray(d?.totp) && d.totp[0]) ||
    (Array.isArray(d?.all) ? d.all.find((f) => f?.factor_type === "totp" && f?.status === "verified") : null);
  if (!totp?.id) {
    return { error: "No verified authenticator is registered for this account." };
  }
  const { data: challengeData, error: chErr } = await mfa.challenge({ factorId: totp.id });
  if (chErr) return { error: chErr.message };
  const challengeId = challengeData?.id;
  if (!challengeId) return { error: "MFA challenge failed." };
  const { error: vErr } = await mfa.verify({
    factorId: totp.id,
    challengeId,
    code: trimmed,
  });
  if (vErr) return { error: vErr.message };
  return { error: null };
}
