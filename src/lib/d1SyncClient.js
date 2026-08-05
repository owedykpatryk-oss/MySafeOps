/**
 * Client for Cloudflare D1 Worker (`cloudflare/workers/d1-api`).
 * Requires: VITE_D1_API_URL, signed-in Supabase user, valid org slug (mysafeops_orgId).
 *
 * Use for incremental migration: read/write JSON blobs that mirror orgStorage keys
 * (e.g. namespace "permits_v2", key "main" → value = array of permits).
 *
 * Softens thundering-herd 429s: concurrent GET dedupe, short success cache, global
 * concurrency gate, and a shared pause when the Worker returns rate_limited.
 */

const NS = (s) => String(s || "").trim();

/** Deduplicate concurrent GETs for the same org/namespace/key (module hops). */
const d1GetInflight = new Map();

/** Short TTL cache for successful GETs — remounts (Projects ↔ Geo-photos) reuse. */
const d1GetCache = new Map();
const GET_CACHE_TTL_MS = 45_000;

/** Max in-flight KV HTTP calls across the whole app. */
const MAX_CONCURRENT_D1 = 4;
let d1Active = 0;
/** @type {Array<() => void>} */
const d1Waiters = [];

/** Shared pause after Worker 429 so every module does not stampede. */
let rateLimitedUntil = 0;

/**
 * Correlation id from Worker (`X-Request-Id` header or JSON `request_id` on some bodies).
 * @param {Response} res
 * @param {object} [body]
 */
function d1Meta(res, body) {
  let rid = "";
  try {
    rid = res.headers?.get?.("X-Request-Id") || res.headers?.get?.("x-request-id") || "";
  } catch {
    rid = "";
  }
  if (!rid && body && typeof body.request_id === "string") rid = body.request_id;
  return rid ? { request_id: rid } : {};
}

function parseRetryAfterMs(res) {
  try {
    const raw = res.headers?.get?.("Retry-After") || res.headers?.get?.("retry-after");
    const sec = Number(raw);
    if (Number.isFinite(sec) && sec > 0) return Math.min(Math.round(sec * 1000), 120_000);
  } catch {
    /* ignore */
  }
  return 20_000;
}

function noteRateLimited(res) {
  const until = Date.now() + parseRetryAfterMs(res);
  if (until > rateLimitedUntil) rateLimitedUntil = until;
}

async function respectRateLimitPause() {
  const wait = rateLimitedUntil - Date.now();
  if (wait > 0) {
    await new Promise((r) => setTimeout(r, Math.min(wait, 60_000)));
  }
}

async function withD1Slot(fn) {
  if (d1Active >= MAX_CONCURRENT_D1) {
    await new Promise((resolve) => {
      d1Waiters.push(resolve);
    });
  }
  d1Active += 1;
  try {
    return await fn();
  } finally {
    d1Active -= 1;
    const next = d1Waiters.shift();
    if (next) next();
  }
}

function cacheKey(org, ns, dataKey) {
  return `${org}|${ns}|${dataKey}`;
}

function readGetCache(key) {
  const hit = d1GetCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > GET_CACHE_TTL_MS) {
    d1GetCache.delete(key);
    return null;
  }
  return hit.result;
}

function writeGetCache(key, result) {
  if (result?.ok) d1GetCache.set(key, { at: Date.now(), result });
}

function invalidateGetCache(org, ns, dataKey) {
  d1GetCache.delete(cacheKey(org, ns, dataKey));
}

/** True for Worker rate limits (body.error or http_429). */
export function isD1RateLimitedError(error) {
  const e = String(error || "");
  return e === "rate_limited" || e === "http_429";
}

/** Transient network / overload errors that may succeed on retry. */
export function isD1TransientError(error) {
  const e = String(error || "");
  return isD1RateLimitedError(e) || /^http_(502|503|504)$/.test(e) || e === "fetch_failed";
}

/**
 * @param {Response} res
 * @param {object} body
 */
function errorFromResponse(res, body) {
  const meta = d1Meta(res, body);
  if (res.status === 429 || body?.error === "rate_limited") {
    noteRateLimited(res);
    return {
      ok: false,
      error: "rate_limited",
      retry_after_ms: parseRetryAfterMs(res),
      ...meta,
    };
  }
  return { ok: false, error: body?.error || `http_${res.status}`, ...meta };
}

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
 */
export async function d1GetKv(supabase, orgSlug, namespace, key) {
  const base = baseUrl();
  if (!base) return { ok: false, error: "d1_not_configured" };
  const ns = NS(namespace);
  const dataKey = NS(key);
  if (!ns || !dataKey) return { ok: false, error: "missing_namespace" };
  const h = await authHeaders(supabase);
  if (h.error) return { ok: false, error: h.error };
  const org = NS(orgSlug);
  if (!org || org === "default") return { ok: false, error: "no_org_slug" };

  const inflightKey = cacheKey(org, ns, dataKey);
  const cached = readGetCache(inflightKey);
  if (cached) return cached;

  const existing = d1GetInflight.get(inflightKey);
  if (existing) return existing;

  const q = new URLSearchParams({ namespace: ns, key: dataKey });
  const pending = (async () => {
    await respectRateLimitPause();
    return withD1Slot(async () => {
      await respectRateLimitPause();
      let res;
      try {
        res = await fetch(`${base}/v1/kv?${q}`, {
          method: "GET",
          headers: {
            ...h,
            "X-Org-Slug": org,
          },
        });
      } catch {
        return { ok: false, error: "fetch_failed" };
      }
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return errorFromResponse(res, body);
      const okResult = {
        ok: true,
        value: body.value,
        version: body.version,
        updated_at: body.updated_at,
      };
      writeGetCache(inflightKey, okResult);
      return okResult;
    });
  })().finally(() => {
    d1GetInflight.delete(inflightKey);
  });

  d1GetInflight.set(inflightKey, pending);
  return pending;
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
  const ns = NS(namespace);
  const dataKey = NS(key);
  if (!ns || !dataKey) return { ok: false, error: "missing_namespace" };
  const h = await authHeaders(supabase);
  if (h.error) return { ok: false, error: h.error };
  const org = NS(orgSlug);
  if (!org || org === "default") return { ok: false, error: "no_org_slug" };

  const payload = { namespace: ns, key: dataKey, value };
  if (ifVersion != null && Number.isFinite(ifVersion)) {
    payload.ifVersion = ifVersion;
  }

  await respectRateLimitPause();
  return withD1Slot(async () => {
    await respectRateLimitPause();
    let res;
    try {
      res = await fetch(`${base}/v1/kv`, {
        method: "PUT",
        headers: {
          ...h,
          "X-Org-Slug": org,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
    } catch {
      return { ok: false, error: "fetch_failed" };
    }
    const body = await res.json().catch(() => ({}));
    if (res.status === 409) {
      invalidateGetCache(org, ns, dataKey);
      return { ok: false, error: "version_conflict", ...body, ...d1Meta(res, body) };
    }
    if (!res.ok) return errorFromResponse(res, body);
    invalidateGetCache(org, ns, dataKey);
    return { ok: true, version: body.version, updated_at: body.updated_at };
  });
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
  const ns = NS(namespace);
  if (!ns) return { ok: false, error: "missing_namespace" };
  const h = await authHeaders(supabase);
  if (h.error) return { ok: false, error: h.error };
  const org = NS(orgSlug);
  if (!org || org === "default") return { ok: false, error: "no_org_slug" };

  const q = new URLSearchParams({ namespace: ns, list: "1" });
  await respectRateLimitPause();
  return withD1Slot(async () => {
    await respectRateLimitPause();
    const res = await fetch(`${base}/v1/kv?${q}`, {
      method: "GET",
      headers: {
        ...h,
        "X-Org-Slug": org,
      },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return errorFromResponse(res, body);
    return { ok: true, items: body.items || [] };
  });
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
  const ns = NS(namespace);
  const dataKey = NS(key);
  if (!ns || !dataKey) return { ok: false, error: "missing_namespace" };
  const h = await authHeaders(supabase);
  if (h.error) return { ok: false, error: h.error };
  const org = NS(orgSlug);
  if (!org || org === "default") return { ok: false, error: "no_org_slug" };

  const q = new URLSearchParams({ namespace: ns, key: dataKey });
  await respectRateLimitPause();
  return withD1Slot(async () => {
    await respectRateLimitPause();
    const res = await fetch(`${base}/v1/kv?${q}`, {
      method: "DELETE",
      headers: {
        ...h,
        "X-Org-Slug": org,
      },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return errorFromResponse(res, body);
    invalidateGetCache(org, ns, dataKey);
    return { ok: true, deleted: body.deleted };
  });
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

  const payload = {
    action: String(row.action || "unknown"),
    entity: String(row.entity || "unknown"),
    detail: row.detail != null ? String(row.detail) : undefined,
    client_row_id: row.id != null ? String(row.id) : undefined,
    extra: {
      at: row.at,
      ...(row.by ? { by: String(row.by) } : {}),
      ...(row.byEmail ? { byEmail: String(row.byEmail) } : {}),
      ...(row.byUserId ? { byUserId: String(row.byUserId) } : {}),
    },
  };

  const maxAttempts = 5;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await respectRateLimitPause();
    const res = await withD1Slot(() =>
      fetch(`${base}/v1/audit/append`, {
        method: "POST",
        headers: {
          ...h,
          "X-Org-Slug": org,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }),
    );
    const body = await res.json().catch(() => ({}));
    if (res.status === 503) return { ok: false, error: "audit_not_configured", ...d1Meta(res, body) };
    if (res.ok) return { ok: true, seq: body.seq };
    if (res.status === 429) {
      noteRateLimited(res);
      if (attempt < maxAttempts - 1) continue;
      return errorFromResponse(res, body);
    }
    if (res.status === 409 && attempt < maxAttempts - 1) {
      await new Promise((r) => setTimeout(r, 50 * 2 ** attempt));
      continue;
    }
    return { ok: false, error: body.error || `http_${res.status}`, ...d1Meta(res, body) };
  }
  return { ok: false, error: "concurrent_append_retry" };
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
  await respectRateLimitPause();
  return withD1Slot(async () => {
    const res = await fetch(`${base}/v1/audit?${q}`, {
      method: "GET",
      headers: { ...h, "X-Org-Slug": org },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return errorFromResponse(res, body);
    return { ok: true, items: body.items || [] };
  });
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

  await respectRateLimitPause();
  return withD1Slot(async () => {
    const res = await fetch(`${base}/v1/audit/verify`, {
      method: "GET",
      headers: { ...h, "X-Org-Slug": org },
    });
    const body = await res.json().catch(() => ({}));
    if (res.status === 503) return { ok: false, error: "audit_not_configured", ...d1Meta(res, body) };
    if (!res.ok) return errorFromResponse(res, body);
    if (body.ok === false) return { ok: false, error: body.error, at_seq: body.at_seq, ...d1Meta(res, body) };
    return { ok: true, entries: body.entries, head: body.head };
  });
}

/** Test helper — clears caches / queues between vitest cases. */
export function __resetD1SyncClientForTests() {
  d1GetInflight.clear();
  d1GetCache.clear();
  rateLimitedUntil = 0;
  d1Active = 0;
  d1Waiters.length = 0;
}
