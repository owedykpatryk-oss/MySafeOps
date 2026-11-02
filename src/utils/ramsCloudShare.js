import { genOpaqueToken } from "./opaqueToken";
import { safeOpaqueToken } from "./htmlEscape";
import { isFessOrg } from "./fessOrg";
import { getFessBrandLogoSrc } from "./fessBranding";
import { loadOrgSettingsRaw } from "./orgSettingsStorage";
import { getOrgMarketId } from "./orgMarket";
import { getActiveDocumentLocale } from "./countryWorkspaces";
import { isUtilityMappingOrg } from "./utilityMappingOrg";
import { resolveUtilityMappingLogoSrc } from "./utilityMappingCovers";

export function createRamsPublicationSnapshot(doc, workers = [], projects = []) {
  const settings = loadOrgSettingsRaw();
  const org = Object.fromEntries(["name", "logo", "primaryColor", "accentColor", "pdfWatermarkText", "pdfComplianceLine", "pdfFooter"].map(key => [key, settings[key] || ""]));
  org.logo = isFessOrg() ? getFessBrandLogoSrc() : resolveUtilityMappingLogoSrc(settings) || org.logo;
  const selected = new Set(doc?.operativeIds || []);
  return JSON.parse(JSON.stringify({
    version: 1, marketId: getOrgMarketId(), locale: getActiveDocumentLocale(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", org,
    utilityMapping: isUtilityMappingOrg(), fess: isFessOrg(),
    workers: workers.filter(worker => selected.has(worker.id)).map(({ id, name, role, certs, certifications }) => ({
      id, name, role, certs,
      certifications: (certifications || []).map(({ certType, expiryDate }) => ({ certType, expiryDate })),
    })),
    projects: projects.filter(project => project.id === doc?.projectId).map(({ id, name }) => ({ id, name })),
  }));
}

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

export async function publishRamsShare(supabase, doc, orgSlug = "default", publicationSnapshot = createRamsPublicationSnapshot(doc), origin = {}) {
  if (!supabase) throw new Error("Sign in to publish a RAMS link for other devices.");
  const { data: { user } = {}, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error("Sign in to publish a RAMS link for other devices.");
  const assertOrigin = () => {
    if ((Object.hasOwn(origin, "expectedUserId") && origin.expectedUserId !== user.id) || origin.isCurrent?.() === false) {
      throw new Error("Account or workspace changed. Open the RAMS again before sharing.");
    }
  };
  assertOrigin();
  if (!doc?.id || !Array.isArray(doc.rows)) throw new Error("Save the RAMS before sharing it.");
  if (!globalThis.crypto?.getRandomValues && !globalThis.crypto?.randomUUID) {
    throw new Error("This browser cannot create a secure RAMS link. Use a current browser over HTTPS.");
  }

  const token = /^r_[a-f0-9]{32,48}$/.test(doc.shareToken || "") ? doc.shareToken : genOpaqueToken("r");
  const previous = doc.sharePublishedAt ? await fetchPublishedRams(supabase, token) : null;
  assertOrigin();
  const publishedAt = new Date().toISOString();
  const rollback = async () => {
    try {
      if (previous) {
        const { error } = await supabase.from("rams_public_shares").update({
          document: previous, active: true, expires_at: previous.shareExpiresAt, updated_at: previous.sharePublishedAt,
        }).eq("token", token).eq("user_id", user.id).eq("updated_at", publishedAt);
        if (error) throw error;
        const restored = await fetchPublishedRams(supabase, token);
        if (restored?.sharePublishedAt !== previous.sharePublishedAt) throw new Error("The publication changed concurrently and was not overwritten.");
      } else {
        const { error } = await supabase.from("rams_public_shares").delete().eq("token", token).eq("user_id", user.id).eq("updated_at", publishedAt);
        if (error) throw error;
        if (await fetchPublishedRams(supabase, token)) throw new Error("The unrecorded share link could not be revoked.");
      }
    } catch (error) {
      try {
        const key = `mysafeops_rams_share_recovery_v1:${encodeURIComponent(JSON.stringify([user.id, origin.storageScope || orgSlug]))}`;
        const pending = JSON.parse(sessionStorage.getItem(key) || "[]");
        sessionStorage.setItem(key, JSON.stringify([...pending, { documentId: doc.id, token, publishedAt, orgSlug }]));
      } catch { /* The error still exposes the reference when recovery storage is unavailable. */ }
      throw new Error(`Share link ${token} may remain published; rollback failed: ${error.message || error}`);
    }
  };
  const expiresAt = shareExpiryIso();
  const shareSourceUpdatedAt = doc.updatedAt || "";
  const document = { ...doc, publicationSnapshot, shareToken: token, sharePublishedAt: publishedAt, shareExpiresAt: expiresAt, shareSourceUpdatedAt };
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
  try {
    const confirmed = await fetchPublishedRams(supabase, token);
    if (confirmed?.id !== doc.id) throw new Error("RAMS link could not be verified after publishing.");
    assertOrigin();
  } catch (error) {
    await rollback();
    throw error;
  }
  return { token, publishedAt, expiresAt, shareSourceUpdatedAt, rollback };
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

/** A public link is usable only after its revocation metadata is durably recorded. */
export async function publishAndCommitRamsShare(supabase, doc, orgSlug, snapshot, origin, persist) {
  const publication = await publishRamsShare(supabase, doc, orgSlug, snapshot, origin);
  const { token, publishedAt, expiresAt, shareSourceUpdatedAt } = publication;
  const document = { ...doc, shareToken: token, sharePublishedAt: publishedAt, shareExpiresAt: expiresAt, shareSourceUpdatedAt };
  try {
    if (origin.isCurrent?.() === false) throw new Error("Workspace changed before the share link could be saved.");
    const committed = persist(document);
    if (!committed?.ok) throw new Error("The share link could not be saved on this device. The publication has been rolled back.");
    return { ...committed, token };
  } catch (error) {
    try { await publication.rollback(); }
    catch (rollbackError) { throw new Error(`Could not save or roll back the share link (${token}): ${rollbackError.message || rollbackError}`); }
    throw error;
  }
}
