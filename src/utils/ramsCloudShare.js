import { genOpaqueToken } from "./opaqueToken";
import { safeOpaqueToken } from "./htmlEscape";

export const RAMS_SHARE_TTL_DAYS = 14;

export function isPublishedRamsShare(doc, now = Date.now()) {
  return /^r_[a-f0-9]{32,48}$/.test(doc?.shareToken || "")
    && Boolean(doc?.sharePublishedAt)
    && Boolean(doc?.shareSourceUpdatedAt)
    && doc.shareSourceUpdatedAt === doc.updatedAt
    && Date.parse(doc?.shareExpiresAt || "") > now;
}

function shareExpiryIso(now = new Date()) {
  return new Date(now.getTime() + RAMS_SHARE_TTL_DAYS * 86400000).toISOString();
}

export async function fetchPublishedRams(supabase, token) {
  const safeToken = safeOpaqueToken(token);
  if (!supabase || !safeToken) return null;
  const { data, error } = await supabase.rpc("fetch_rams_public_share", { p_token: safeToken });
  if (error) throw error;
  if (!data?.document || typeof data.document !== "object" || Array.isArray(data.document)) return null;
  return data.document;
}

export async function publishRamsShare(supabase, doc, orgSlug = "default") {
  if (!supabase) throw new Error("Sign in to publish a RAMS link for other devices.");
  const { data: { user } = {}, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error("Sign in to publish a RAMS link for other devices.");
  if (!doc?.id || !Array.isArray(doc.rows)) throw new Error("Save the RAMS before sharing it.");
  if (!globalThis.crypto?.getRandomValues && !globalThis.crypto?.randomUUID) {
    throw new Error("This browser cannot create a secure RAMS link. Use a current browser over HTTPS.");
  }

  const token = /^r_[a-f0-9]{32,48}$/.test(doc.shareToken || "") ? doc.shareToken : genOpaqueToken("r");
  const publishedAt = new Date().toISOString();
  const expiresAt = shareExpiryIso();
  const shareSourceUpdatedAt = doc.updatedAt || "";
  const document = { ...doc, shareToken: token, sharePublishedAt: publishedAt, shareExpiresAt: expiresAt, shareSourceUpdatedAt };
  const { error } = await supabase.from("rams_public_shares").upsert({
    token,
    user_id: user.id,
    org_slug: orgSlug || "default",
    document,
    active: true,
    expires_at: expiresAt,
    updated_at: publishedAt,
  }, { onConflict: "token" });
  if (error) throw error;
  const confirmed = await fetchPublishedRams(supabase, token);
  if (confirmed?.id !== doc.id) throw new Error("RAMS link could not be verified after publishing.");
  return { token, publishedAt, expiresAt, shareSourceUpdatedAt };
}

export async function revokeRamsShare(supabase, doc) {
  if (!doc?.shareToken || !doc?.sharePublishedAt) return;
  if (!supabase) throw new Error("Sign in to revoke this RAMS link before deleting the document.");
  const { data: { user } = {}, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error("Sign in to revoke this RAMS link before deleting the document.");
  const { error } = await supabase.from("rams_public_shares")
    .delete().eq("token", doc.shareToken).eq("user_id", user.id);
  if (error) throw error;
  if (await fetchPublishedRams(supabase, doc.shareToken)) {
    throw new Error("RAMS link is still available after revocation.");
  }
}
