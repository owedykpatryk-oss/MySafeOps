import {
  getLocalOrgBrandingUpdatedAt,
  loadOrgSettingsRaw,
  pickCloudBrandingPayload,
  saveOrgSettingsRaw,
} from "./orgSettingsStorage";

/** @param {Record<string, unknown>} settings */
export async function resolveBrandingLogoUrl(settings) {
  if (!settings || typeof settings !== "object") return settings;
  if (settings.logo || !settings.logoUrl) return settings;
  const url = String(settings.logoUrl);
  try {
    const res = await fetch(url);
    if (!res.ok) return settings;
    const blob = await res.blob();
    const logo = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    return { ...settings, logo, logoUrl: url };
  } catch {
    return settings;
  }
}

/**
 * Pull shared org branding from Supabase when cloud is newer than local cache.
 * @returns {Promise<boolean>} true when local settings were updated
 */
export async function syncOrgBrandingFromCloud(supabase, orgSlug) {
  if (!supabase || !orgSlug || orgSlug === "default") return false;

  const { data, error } = await supabase.rpc("get_my_org_branding");
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.settings || typeof row.settings !== "object") return false;

  const cloudAt = row.updated_at ? new Date(row.updated_at).getTime() : 0;
  const localAtRaw = getLocalOrgBrandingUpdatedAt(orgSlug);
  const localAt = localAtRaw ? new Date(localAtRaw).getTime() : 0;
  const localRaw = loadOrgSettingsRaw(orgSlug);
  const localEmpty = !localRaw?.name || localRaw.name === "My Organisation";

  if (cloudAt && localAt >= cloudAt && !localEmpty) return false;

  let merged = await resolveBrandingLogoUrl(row.settings);
  const existing = loadOrgSettingsRaw(orgSlug);
  merged = {
    ...existing,
    ...merged,
    customFields: existing.customFields?.length ? existing.customFields : merged.customFields || [],
  };
  saveOrgSettingsRaw(merged, orgSlug, row.updated_at || new Date().toISOString());
  return true;
}

/**
 * Push local branding to Supabase (admin RPC). Strips heavy logo if logoUrl is set.
 * @returns {Promise<string|null>} cloud updated_at ISO
 */
export async function pushOrgBrandingToCloud(supabase, rawSettings) {
  if (!supabase) return null;
  let payload = pickCloudBrandingPayload(rawSettings);
  if (payload.logo && payload.logoUrl && String(payload.logo).length > 120_000) {
    const { logo, ...rest } = payload;
    payload = rest;
  }
  const { data, error } = await supabase.rpc("update_my_org_branding", { p_settings: payload });
  if (error) throw error;
  return data ? String(data) : null;
}
