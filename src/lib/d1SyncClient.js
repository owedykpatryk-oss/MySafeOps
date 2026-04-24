/**
 * Client for Cloudflare D1 Worker (`cloudflare/workers/d1-api`).
 * Requires: VITE_D1_API_URL, signed-in Supabase user, valid org slug (mysafeops_orgId).
 *
 * Use for incremental migration: read/write JSON blobs that mirror orgStorage keys
 * (e.g. namespace "permits_v2", key "main" → value = array of permits).
 */

const NS = (s) => String(s || "").trim();

function baseUrl() {
  const u = (import.meta.env.VITE_D1_API_URL || "").trim().replace(/\/+$/, "");
  return u || null;
}

async function authHeaders(supabase) {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data?.session?.access_token) {
    return { error: "no_session" };
  }
  return {
    Authorization: `Bearer ${data.session.access_token}`,
  };
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} orgSlug from getOrgId()
 * @param {string} namespace e.g. "permits_v2"
 * @param {string} key e.g. "main" or "list"
 * @returns {Promise<{ ok: boolean, value?: *, version?: number, updated_at?: string | null, error?: string }>}
 */
export async function d1GetKv(supabase, orgSlug, namespace, key) {
  const base = baseUrl();
  if (!base) return { ok: false, error: "d1_not_configured" };
  const h = await authHeaders(supabase);
  if (h.error) return { ok: false, error: h.error };
  const org = NS(orgSlug);
  if (!org || org === "default") return { ok: false, error: "no_org_slug" };

  const q = new URLSearchParams({ namespace: NS(namespace), key: NS(key) });
  const res = await fetch(`${base}/v1/kv?${q}`, {
    method: "GET",
    headers: {
      ...h,
      "X-Org-Slug": org,
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: body.error || `http_${res.status}` };
  return {
    ok: true,
    value: body.value,
    version: body.version,
    updated_at: body.updated_at,
  };
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} orgSlug
 * @param {string} namespace
 * @param {string} key
 * @param {unknown} value JSON-serializable
 * @param {number} [ifVersion] optimistic concurrency (omit for blind upsert)
 */
export async function d1PutKv(supabase, orgSlug, namespace, key, value, ifVersion) {
  const base = baseUrl();
  if (!base) return { ok: false, error: "d1_not_configured" };
  const h = await authHeaders(supabase);
  if (h.error) return { ok: false, error: h.error };
  const org = NS(orgSlug);
  if (!org || org === "default") return { ok: false, error: "no_org_slug" };

  const payload = { namespace: NS(namespace), key: NS(key), value };
  if (ifVersion != null && Number.isFinite(ifVersion)) {
    payload.ifVersion = ifVersion;
  }

  const res = await fetch(`${base}/v1/kv`, {
    method: "PUT",
    headers: {
      ...h,
      "X-Org-Slug": org,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (res.status === 409) {
    return { ok: false, error: "version_conflict", ...body };
  }
  if (!res.ok) return { ok: false, error: body.error || `http_${res.status}` };
  return { ok: true, version: body.version, updated_at: body.updated_at };
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} orgSlug
 * @param {string} namespace
 * @returns {Promise<{ ok: boolean, items?: Array<{ data_key: string, version: number, updated_at: string, value_bytes: number }>, error?: string }>}
 */
export async function d1ListKvKeys(supabase, orgSlug, namespace) {
  const base = baseUrl();
  if (!base) return { ok: false, error: "d1_not_configured" };
  const h = await authHeaders(supabase);
  if (h.error) return { ok: false, error: h.error };
  const org = NS(orgSlug);
  if (!org || org === "default") return { ok: false, error: "no_org_slug" };

  const q = new URLSearchParams({ namespace: NS(namespace), list: "1" });
  const res = await fetch(`${base}/v1/kv?${q}`, {
    method: "GET",
    headers: {
      ...h,
      "X-Org-Slug": org,
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: body.error || `http_${res.status}` };
  return { ok: true, items: body.items || [] };
}

export function isD1Configured() {
  return Boolean(baseUrl());
}

/**
 * DELETE a namespaced key (e.g. tombstone for migration).
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 */
export async function d1DeleteKv(supabase, orgSlug, namespace, key) {
  const base = baseUrl();
  if (!base) return { ok: false, error: "d1_not_configured" };
  const h = await authHeaders(supabase);
  if (h.error) return { ok: false, error: h.error };
  const org = NS(orgSlug);
  if (!org || org === "default") return { ok: false, error: "no_org_slug" };

  const q = new URLSearchParams({ namespace: NS(namespace), key: NS(key) });
  const res = await fetch(`${base}/v1/kv?${q}`, {
    method: "DELETE",
    headers: {
      ...h,
      "X-Org-Slug": org,
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: body.error || `http_${res.status}` };
  return { ok: true, deleted: body.deleted };
}

/**
 * Append one audit event (append-only, hash chain on server; requires Worker secret AUDIT_CHAIN_SECRET).
 * Fire-and-forget from pushAudit; failures are non-fatal.
 */
export async function d1AppendServerAudit(supabase, orgSlug, row) {
  const base = baseUrl();
  if (!base) return { ok: false, error: "d1_not_configured" };
  const h = await authHeaders(supabase);
  if (h.error) return { ok: false, error: h.error };
  const org = NS(orgSlug);
  if (!org || org === "default") return { ok: false, error: "no_org_slug" };

  const res = await fetch(`${base}/v1/audit/append`, {
    method: "POST",
    headers: {
      ...h,
      "X-Org-Slug": org,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: String(row.action || "unknown"),
      entity: String(row.entity || "unknown"),
      detail: row.detail != null ? String(row.detail) : undefined,
      client_row_id: row.id != null ? String(row.id) : undefined,
      extra: { at: row.at },
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (res.status === 503) return { ok: false, error: "audit_not_configured" };
  if (!res.ok) return { ok: false, error: body.error || `http_${res.status}` };
  return { ok: true, seq: body.seq };
}

/**
 * @returns {Promise<{ ok: boolean, items?: any[], error?: string }>}
 */
export async function d1ListServerAudit(supabase, orgSlug, { limit = 50, afterSeq = 0 } = {}) {
  const base = baseUrl();
  if (!base) return { ok: false, error: "d1_not_configured" };
  const h = await authHeaders(supabase);
  if (h.error) return { ok: false, error: h.error };
  const org = NS(orgSlug);
  if (!org || org === "default") return { ok: false, error: "no_org_slug" };

  const q = new URLSearchParams({ limit: String(limit), after_seq: String(afterSeq) });
  const res = await fetch(`${base}/v1/audit?${q}`, {
    method: "GET",
    headers: { ...h, "X-Org-Slug": org },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: body.error || `http_${res.status}` };
  return { ok: true, items: body.items || [] };
}

/**
 * @returns {Promise<{ ok: boolean, entries?: number, error?: string }>}
 */
export async function d1VerifyServerAuditChain(supabase, orgSlug) {
  const base = baseUrl();
  if (!base) return { ok: false, error: "d1_not_configured" };
  const h = await authHeaders(supabase);
  if (h.error) return { ok: false, error: h.error };
  const org = NS(orgSlug);
  if (!org || org === "default") return { ok: false, error: "no_org_slug" };

  const res = await fetch(`${base}/v1/audit/verify`, {
    method: "GET",
    headers: { ...h, "X-Org-Slug": org },
  });
  const body = await res.json().catch(() => ({}));
  if (res.status === 503) return { ok: false, error: "audit_not_configured" };
  if (!res.ok) return { ok: false, error: body.error || `http_${res.status}` };
  if (body.ok === false) return { ok: false, error: body.error, at_seq: body.at_seq };
  return { ok: true, entries: body.entries, head: body.head };
}
