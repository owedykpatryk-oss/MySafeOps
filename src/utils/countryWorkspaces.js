import { getMarket, resolveMarketId } from "../config/markets";
import { getOrgId } from "./orgId";

export const COUNTRY_WORKSPACE_CHANGED_EVENT = "mysafeops-country-workspace-changed";

export const COUNTRY_WORKSPACE_MARKETS = ["uk", "pl", "au"];

const COUNTRY_NAMES = {
  uk: "United Kingdom",
  pl: "Poland",
  au: "Australia",
};

const CURRENCY_BY_MARKET = {
  uk: "GBP",
  pl: "PLN",
  au: "AUD",
};

function activeWorkspaceKey(orgSlug = getOrgId()) {
  return `mysafeops_active_country_workspace_${orgSlug || "default"}`;
}

function activeWorkspaceSnapshotKey(orgSlug = getOrgId()) {
  return `mysafeops_active_country_workspace_snapshot_${orgSlug || "default"}`;
}

export function countryWorkspaceDefinition(marketId) {
  const id = resolveMarketId(marketId);
  const market = getMarket(id);
  return {
    marketId: id,
    name: COUNTRY_NAMES[id],
    flag: market.flag,
    locale: market.locale,
    currency: CURRENCY_BY_MARKET[id],
  };
}

export function getCachedActiveCountryWorkspaceId(orgSlug = getOrgId()) {
  try {
    return localStorage.getItem(activeWorkspaceKey(orgSlug)) || null;
  } catch {
    return null;
  }
}

export function cacheActiveCountryWorkspaceId(workspaceId, orgSlug = getOrgId()) {
  const previous = getCachedActiveCountryWorkspaceId(orgSlug);
  try {
    if (workspaceId) localStorage.setItem(activeWorkspaceKey(orgSlug), workspaceId);
    else localStorage.removeItem(activeWorkspaceKey(orgSlug));
  } catch {
    /* storage unavailable */
  }
  if (previous !== (workspaceId || null)) {
    window.dispatchEvent(new CustomEvent(COUNTRY_WORKSPACE_CHANGED_EVENT, { detail: { workspaceId } }));
  }
}

export function getCachedActiveCountryWorkspace(orgSlug = getOrgId()) {
  try {
    const parsed = JSON.parse(localStorage.getItem(activeWorkspaceSnapshotKey(orgSlug)) || "null");
    return parsed?.id ? parsed : null;
  } catch {
    return null;
  }
}

export function cacheActiveCountryWorkspace(workspace, orgSlug = getOrgId()) {
  const previous = getCachedActiveCountryWorkspace(orgSlug);
  let next = null;
  try {
    if (workspace?.id) {
      next = {
        id: workspace.id,
        org_id: workspace.org_id,
        market_id: workspace.market_id,
        display_name: workspace.display_name,
        default_document_locale: workspace.default_document_locale,
        is_primary: Boolean(workspace.is_primary),
        billing: workspace.billing || null,
      };
      localStorage.setItem(activeWorkspaceKey(orgSlug), workspace.id);
      localStorage.setItem(activeWorkspaceSnapshotKey(orgSlug), JSON.stringify(next));
    } else {
      localStorage.removeItem(activeWorkspaceKey(orgSlug));
      localStorage.removeItem(activeWorkspaceSnapshotKey(orgSlug));
    }
  } catch {
    /* storage unavailable */
  }
  if (JSON.stringify(previous) !== JSON.stringify(next)) {
    window.dispatchEvent(new CustomEvent(COUNTRY_WORKSPACE_CHANGED_EVENT, { detail: { workspace: next } }));
  }
}

async function resolveOrgRow(supabase, orgSlug = getOrgId()) {
  const { data, error } = await supabase
    .from("organizations")
    .select("id, slug")
    .eq("slug", orgSlug)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data?.id) throw new Error("Organisation not found.");
  return data;
}

export async function loadCountryWorkspaces(supabase, orgSlug = getOrgId(), { stripeMode = "live" } = {}) {
  if (!supabase) return [];
  const org = await resolveOrgRow(supabase, orgSlug);
  const { data: workspaces, error } = await supabase
    .from("org_country_workspaces")
    .select("id, org_id, market_id, display_name, default_document_locale, is_primary, enabled, migration_source, created_at")
    .eq("org_id", org.id)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) throw error;

  let preferredWorkspaceId = null;
  try {
    const { data: authData } = await supabase.auth.getUser();
    if (authData?.user?.id) {
      const { data: preference } = await supabase
        .from("org_user_preferences")
        .select("active_workspace_id")
        .eq("org_id", org.id)
        .eq("user_id", authData.user.id)
        .maybeSingle();
      preferredWorkspaceId = preference?.active_workspace_id || null;
    }
  } catch {
    preferredWorkspaceId = null;
  }

  let subscriptions = [];
  // A failed read is not the same as "no subscription": callers must not downgrade a
  // paying organisation to unentitled just because the entitlement RPC was unreachable.
  let billingReadable = true;
  try {
    const { data, error: subscriptionError } = await supabase.rpc("get_my_country_workspace_entitlements", {
      p_org_slug: orgSlug,
      p_stripe_mode: stripeMode,
    });
    if (subscriptionError) throw subscriptionError;
    subscriptions = data || [];
  } catch {
    subscriptions = [];
    billingReadable = false;
  }
  const billingByWorkspace = new Map(subscriptions.map((row) => [row.workspace_id, row]));
  return (workspaces || []).map((workspace) => ({
    ...workspace,
    billing: billingByWorkspace.get(workspace.id) || null,
    billing_unavailable: !billingReadable,
    is_user_preferred: workspace.id === preferredWorkspaceId,
  }));
}

export async function ensureLegacyCountryWorkspace(supabase, marketId, orgSlug = getOrgId()) {
  if (!supabase) return null;
  const market = resolveMarketId(marketId);
  const { data, error } = await supabase.rpc("claim_legacy_country_workspace", {
    p_org_slug: orgSlug,
    p_market_id: market,
  });
  if (error) throw error;
  if (data) cacheActiveCountryWorkspaceId(data, orgSlug);
  return data || null;
}

export async function createCountryWorkspace(supabase, marketId, orgSlug = getOrgId()) {
  if (!supabase) throw new Error("Cloud sign-in is required.");
  const definition = countryWorkspaceDefinition(marketId);
  const { data: workspaceId, error } = await supabase.rpc("add_org_country_workspace", {
    p_org_slug: orgSlug,
    p_market_id: definition.marketId,
  });
  if (error) throw error;
  const workspaces = await loadCountryWorkspaces(supabase, orgSlug);
  const workspace = workspaces.find((item) => item.id === workspaceId);
  if (!workspace) throw new Error("Country workspace was created but could not be reloaded.");
  // Deliberately not activated here: switching the operational country repoints every
  // storage key and must go through `setActiveCountryWorkspace` + reload, or modules
  // still holding the previous country's records would write them into the new one.
  return workspace;
}

export async function setActiveCountryWorkspace(supabase, workspace, orgSlug = getOrgId()) {
  if (!workspace?.id) throw new Error("Country workspace is required.");
  cacheActiveCountryWorkspace(workspace, orgSlug);
  try {
    const { applyMarketModuleDefaults } = await import("./marketModuleSync");
    applyMarketModuleDefaults(workspace.market_id, orgSlug);
  } catch {
    /* market-specific module defaults remain unchanged */
  }
  window.dispatchEvent(new CustomEvent("mysafeops-org-updated"));
  if (!supabase || !workspace.org_id) return workspace;
  const { data: authData } = await supabase.auth.getUser();
  if (!authData?.user?.id) return workspace;
  const { error } = await supabase.from("org_user_preferences").upsert(
    {
      org_id: workspace.org_id,
      user_id: authData.user.id,
      active_workspace_id: workspace.id,
    },
    { onConflict: "org_id,user_id" },
  );
  if (error) throw error;
  return workspace;
}

export async function updateCountryWorkspaceDocumentLocale(supabase, workspace, documentLocale) {
  if (!supabase || !workspace?.id) throw new Error("Country workspace is required.");
  if (!["en-GB", "pl-PL", "en-AU"].includes(documentLocale)) {
    throw new Error("Unsupported document language.");
  }

  const { data, error } = await supabase
    .from("org_country_workspaces")
    .update({ default_document_locale: documentLocale })
    .eq("id", workspace.id)
    .select("id, org_id, market_id, display_name, default_document_locale, is_primary, enabled, migration_source, created_at")
    .single();
  if (error) throw error;

  const preferences = ["rams", "permit", "survey", "site_report"].map((documentType) => ({
    workspace_id: workspace.id,
    document_type: documentType,
    document_locale: documentLocale,
  }));
  const { error: preferenceError } = await supabase
    .from("org_document_language_preferences")
    .upsert(preferences, { onConflict: "workspace_id,document_type" });
  if (preferenceError) throw preferenceError;

  const updated = { ...workspace, ...data };
  cacheActiveCountryWorkspace(updated);
  return updated;
}

export function pickActiveCountryWorkspace(workspaces, orgSlug = getOrgId()) {
  const cachedId = getCachedActiveCountryWorkspaceId(orgSlug);
  return (
    workspaces.find((workspace) => workspace.id === cachedId && workspace.enabled) ||
    workspaces.find((workspace) => workspace.is_user_preferred && workspace.enabled) ||
    workspaces.find((workspace) => workspace.is_primary && workspace.enabled) ||
    workspaces.find((workspace) => workspace.enabled) ||
    null
  );
}

export function getWorkspaceDocumentLocale(workspace, fallbackMarketId = "uk") {
  return workspace?.default_document_locale || getMarket(resolveMarketId(fallbackMarketId)).locale;
}

export function getActiveDocumentLocale(orgSlug = getOrgId(), fallbackMarketId = "uk") {
  const workspace = getCachedActiveCountryWorkspace(orgSlug);
  return getWorkspaceDocumentLocale(workspace, fallbackMarketId);
}

export function workspaceHasPaidAccess(workspace) {
  return ["active", "trialing"].includes(String(workspace?.billing?.subscription_status || ""));
}
