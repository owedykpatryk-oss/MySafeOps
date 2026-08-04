/**
 * MySafeOps D1 API — org-scoped JSON key/value + append-only hash-chained audit.
 *
 * Auth: Authorization: Bearer <Supabase user JWT>
 *       X-Org-Slug: <organisations.slug>
 *       Reads: membership via user_can_access_org_slug
 *       Writes: membership + billing via user_can_write_org_slug (+ role RPCs for KV)
 *
 * GET  /v1/health
 * GET  /v1/kv?namespace=&key=   |  ?namespace=&list=1
 * PUT  /v1/kv  JSON { namespace, key, value, ifVersion? }  (operative: no master-data namespaces)
 * DELETE /v1/kv?namespace=&key=  (admin + supervisor only — RPC user_can_delete_org_kv)
 * POST /v1/audit/append  JSON { action, entity, detail?, client_row_id?, extra? }
 * GET  /v1/audit?limit=50&after_seq=0
 * GET  /v1/audit/verify  (recomputes chain; use sparingly on large orgs)
 */

import { isValidD1Namespace } from "../../../shared/d1NamespacePolicy.mjs";

const GENESIS_HASH = "0".repeat(64);
/** Audit action/entity — blocks injection of arbitrary strings into the hash chain. */
const AUDIT_FIELD_RE = /^[a-z][a-z0-9_]{0,63}$/i;

const AUDIT_APPEND_MAX_PER_MINUTE = 90;
const KV_PUT_MAX_PER_MINUTE = 120;
const KV_GET_MAX_PER_MINUTE = 180;

function currentRateWindowStart() {
  const d = new Date();
  d.setUTCSeconds(0, 0);
  return d.toISOString();
}

/** Sliding 60s window per bucket key; atomic upsert. Fails closed unless D1_RATE_LIMIT_FAIL_OPEN=true. */
async function consumeRateLimit(env, bucketKey, maxPerMinute) {
  try {
    const windowStart = currentRateWindowStart();
    const row = await env.DB.prepare(
      `INSERT INTO org_api_rate (bucket_key, window_start, count)
       VALUES (?, ?, 1)
       ON CONFLICT(bucket_key) DO UPDATE SET
         count = CASE
           WHEN org_api_rate.window_start = excluded.window_start THEN org_api_rate.count + 1
           ELSE 1
         END,
         window_start = CASE
           WHEN org_api_rate.window_start = excluded.window_start THEN org_api_rate.window_start
           ELSE excluded.window_start
         END
       RETURNING count`
    )
      .bind(bucketKey, windowStart)
      .first();
    const next = Number(row?.count) || 0;
    return next > 0 && next <= maxPerMinute;
  } catch {
    return String(env?.D1_RATE_LIMIT_FAIL_OPEN || "").toLowerCase() === "true";
  }
}

function isValidAuditField(value) {
  const s = String(value || "").trim();
  return s.length > 0 && s.length <= 64 && AUDIT_FIELD_RE.test(s);
}

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...extra },
  });
}

function isOriginAllowed(origin, allowed) {
  if (!origin || allowed.length === 0) return false;
  if (allowed.includes(origin)) return true;
  if (allowed.includes("vercel_preview:mysafeops")) {
    try {
      const u = new URL(origin);
      if (u.protocol === "https:" && u.hostname.endsWith(".vercel.app") && u.hostname.startsWith("mysafeops")) {
        return true;
      }
    } catch {
      /* ignore */
    }
  }
  return false;
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const base = {
    "Access-Control-Allow-Methods": "GET, PUT, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Org-Slug",
    "Access-Control-Max-Age": "86400",
  };
  // Fail closed: omit ACAO when unset / disallowed — never echo '*' or the string "null".
  if (!origin || !isOriginAllowed(origin, allowed)) return base;
  return {
    ...base,
    "Access-Control-Allow-Origin": origin,
    Vary: "Origin",
  };
}

function secHeaders() {
  return {
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  };
}

function parseJwtSub(authHeader) {
  try {
    const t = String(authHeader || "");
    const m = /^Bearer\s+(.+)$/i.exec(t);
    if (!m) return null;
    const parts = m[1].split(".");
    if (parts.length < 2) return null;
    let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4;
    if (pad) b64 += "====".slice(0, 4 - pad);
    const jsonStr = atob(b64);
    const p = JSON.parse(jsonStr);
    return p.sub || null;
  } catch {
    return null;
  }
}

function sortKeysDeep(x) {
  if (x === null || typeof x !== "object") return x;
  if (Array.isArray(x)) return x.map((y) => sortKeysDeep(y));
  const out = {};
  for (const k of Object.keys(x).sort()) {
    out[k] = sortKeysDeep(x[k]);
  }
  return out;
}

function stableStringify(obj) {
  return JSON.stringify(sortKeysDeep(obj));
}

const te = new TextEncoder();

async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey("raw", te.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const data = typeof message === "string" ? te.encode(message) : message;
  const buf = await crypto.subtle.sign("HMAC", key, data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function verifyOrgAccess(env, authHeader, orgSlug) {
  const url = (env.SUPABASE_URL || "").replace(/\/+$/, "");
  const anon = env.SUPABASE_ANON_KEY || "";
  if (!url || !anon) {
    return { ok: false, error: "Server misconfiguration: missing SUPABASE_URL or SUPABASE_ANON_KEY" };
  }
  if (!orgSlug || !authHeader || !String(authHeader).toLowerCase().startsWith("bearer ")) {
    return { ok: false, error: "Missing Authorization or X-Org-Slug" };
  }

  const res = await fetch(`${url}/rest/v1/rpc/user_can_access_org_slug`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anon,
      Authorization: authHeader,
    },
    body: JSON.stringify({ p_org_slug: orgSlug }),
  });

  if (res.status === 401 || res.status === 403) {
    return { ok: false, error: "Unauthorized" };
  }
  if (!res.ok) {
    const t = await res.text();
    return { ok: false, error: `Supabase error ${res.status}: ${t.slice(0, 200)}` };
  }

  const data = await res.json();
  const allowed = data === true || data === "true";
  if (!allowed) {
    return { ok: false, error: "Forbidden: not a member of this organisation" };
  }
  return { ok: true };
}

/**
 * Membership + subscription/trial write gate for mutating routes.
 * Falls back to membership-only when RPC is not deployed yet (404).
 */
async function verifyOrgCloudWrite(env, authHeader, orgSlug) {
  const url = (env.SUPABASE_URL || "").replace(/\/+$/, "");
  const anon = env.SUPABASE_ANON_KEY || "";
  if (!url || !anon) {
    return { ok: false, error: "Server misconfiguration: missing SUPABASE_URL or SUPABASE_ANON_KEY" };
  }
  if (!orgSlug || !authHeader || !String(authHeader).toLowerCase().startsWith("bearer ")) {
    return { ok: false, error: "Missing Authorization or X-Org-Slug" };
  }

  const res = await fetch(`${url}/rest/v1/rpc/user_can_write_org_slug`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anon,
      Authorization: authHeader,
    },
    body: JSON.stringify({ p_org_slug: orgSlug }),
  });

  if (res.status === 404) {
    return verifyOrgAccess(env, authHeader, orgSlug);
  }
  if (res.status === 401 || res.status === 403) {
    return { ok: false, error: "Unauthorized" };
  }
  if (!res.ok) {
    const t = await res.text();
    return { ok: false, error: `Supabase error ${res.status}: ${t.slice(0, 200)}` };
  }

  const data = await res.json();
  const allowed = data === true || data === "true";
  if (!allowed) {
    return { ok: false, error: "billing_write_blocked" };
  }
  return { ok: true };
}

/** GET audit / verify only — admin + supervisor (RPC). Falls back to org membership if RPC missing (404). */
async function verifyOrgAuditRead(env, authHeader, orgSlug) {
  const url = (env.SUPABASE_URL || "").replace(/\/+$/, "");
  const anon = env.SUPABASE_ANON_KEY || "";
  if (!url || !anon) {
    return { ok: false, error: "Server misconfiguration: missing SUPABASE_URL or SUPABASE_ANON_KEY" };
  }
  if (!orgSlug || !authHeader || !String(authHeader).toLowerCase().startsWith("bearer ")) {
    return { ok: false, error: "Missing Authorization or X-Org-Slug" };
  }

  const res = await fetch(`${url}/rest/v1/rpc/user_can_read_org_audit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anon,
      Authorization: authHeader,
    },
    body: JSON.stringify({ p_org_slug: orgSlug }),
  });

  if (res.status === 404) {
    return verifyOrgAccess(env, authHeader, orgSlug);
  }
  if (res.status === 401 || res.status === 403) {
    return { ok: false, error: "Unauthorized" };
  }
  if (!res.ok) {
    const t = await res.text();
    return { ok: false, error: `Supabase error ${res.status}: ${t.slice(0, 200)}` };
  }

  const data = await res.json();
  const allowed = data === true || data === "true";
  if (!allowed) {
    return { ok: false, error: "Forbidden: audit read requires admin or supervisor role" };
  }
  return { ok: true };
}

/** DELETE /v1/kv — admin + supervisor only (RPC). Falls back to deny if RPC missing. */
async function verifyOrgKvDelete(env, authHeader, orgSlug, dataKey) {
  const url = (env.SUPABASE_URL || "").replace(/\/+$/, "");
  const anon = env.SUPABASE_ANON_KEY || "";
  if (!url || !anon) {
    return { ok: false, error: "Server misconfiguration: missing SUPABASE_URL or SUPABASE_ANON_KEY" };
  }
  if (!orgSlug || !authHeader || !String(authHeader).toLowerCase().startsWith("bearer ")) {
    return { ok: false, error: "Missing Authorization or X-Org-Slug" };
  }

  const res = await fetch(`${url}/rest/v1/rpc/user_can_delete_org_country_kv`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anon,
      Authorization: authHeader,
    },
    body: JSON.stringify({ p_org_slug: orgSlug, p_data_key: dataKey }),
  });

  if (res.status === 404) {
    return { ok: false, error: "Forbidden: KV delete requires admin or supervisor role" };
  }
  if (res.status === 401 || res.status === 403) {
    return { ok: false, error: "Unauthorized" };
  }
  if (!res.ok) {
    const t = await res.text();
    return { ok: false, error: `Supabase error ${res.status}: ${t.slice(0, 200)}` };
  }

  const data = await res.json();
  const allowed = data === true || data === "true";
  if (!allowed) {
    return { ok: false, error: "Forbidden: KV delete requires admin or supervisor role" };
  }
  return { ok: true };
}

/** PUT /v1/kv — namespace-scoped write (RPC). Falls back to membership-only if RPC missing. */
async function verifyOrgKvWrite(env, authHeader, orgSlug, namespace, dataKey) {
  const url = (env.SUPABASE_URL || "").replace(/\/+$/, "");
  const anon = env.SUPABASE_ANON_KEY || "";
  if (!url || !anon) {
    return { ok: false, error: "Server misconfiguration: missing SUPABASE_URL or SUPABASE_ANON_KEY" };
  }
  if (!orgSlug || !authHeader || !String(authHeader).toLowerCase().startsWith("bearer ")) {
    return { ok: false, error: "Missing Authorization or X-Org-Slug" };
  }
  if (!isValidD1Namespace(namespace)) {
    return { ok: false, error: "invalid_namespace" };
  }

  const res = await fetch(`${url}/rest/v1/rpc/user_can_write_org_country_kv`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anon,
      Authorization: authHeader,
    },
    body: JSON.stringify({ p_org_slug: orgSlug, p_namespace: namespace, p_data_key: dataKey }),
  });

  if (res.status === 404) {
    return dataKey.startsWith("country:")
      ? { ok: false, error: "country_workspace_gate_missing" }
      : verifyOrgAccess(env, authHeader, orgSlug);
  }
  if (res.status === 401 || res.status === 403) {
    return { ok: false, error: "Unauthorized" };
  }
  if (!res.ok) {
    const t = await res.text();
    return { ok: false, error: `Supabase error ${res.status}: ${t.slice(0, 200)}` };
  }

  const data = await res.json();
  const allowed = data === true || data === "true";
  if (!allowed) {
    return { ok: false, error: "Forbidden: cannot write this namespace for your role" };
  }
  return { ok: true };
}

async function verifyOrgCountryKvRead(env, authHeader, orgSlug, dataKey) {
  const url = (env.SUPABASE_URL || "").replace(/\/+$/, "");
  const anon = env.SUPABASE_ANON_KEY || "";
  if (!url || !anon || !dataKey) return { ok: false, error: "Server misconfiguration or missing key" };
  const res = await fetch(`${url}/rest/v1/rpc/user_can_read_org_country_kv`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: anon, Authorization: authHeader },
    body: JSON.stringify({ p_org_slug: orgSlug, p_data_key: dataKey }),
  });
  if (res.status === 404) {
    // Fail closed for new country keys when the matching database migration is absent.
    return dataKey.startsWith("country:")
      ? { ok: false, error: "country_workspace_gate_missing" }
      : verifyOrgAccess(env, authHeader, orgSlug);
  }
  if (!res.ok) return { ok: false, error: res.status === 401 || res.status === 403 ? "Unauthorized" : "country_workspace_gate_failed" };
  const data = await res.json();
  return data === true || data === "true" ? { ok: true } : { ok: false, error: "country_workspace_forbidden" };
}

function handleHealth(c, requestId) {
  return json({ ok: true, service: "mysafeops-d1-api", request_id: requestId }, 200, c);
}

async function handleKvGet(request, env, orgSlug, c, authHeader) {
  const url = new URL(request.url);
  const namespace = (url.searchParams.get("namespace") || "").trim();
  const key = (url.searchParams.get("key") || "").trim();
  const list = url.searchParams.get("list") === "1";
  if (!namespace) {
    return json({ error: "missing_namespace" }, 400, c);
  }
  if (!isValidD1Namespace(namespace)) {
    return json({ error: "invalid_namespace" }, 400, c);
  }
  const actorSub = parseJwtSub(authHeader);
  if (actorSub) {
    const allowed = await consumeRateLimit(env, `kv_get:${orgSlug}:${actorSub}`, KV_GET_MAX_PER_MINUTE);
    if (!allowed) return json({ error: "rate_limited" }, 429, c);
  }

  if (list) {
    const { results } = await env.DB.prepare(
      `SELECT data_key, version, updated_at, LENGTH(value_json) AS value_bytes
       FROM org_sync_kv WHERE org_slug = ? AND namespace = ?`
    )
      .bind(orgSlug, namespace)
      .all();
    // Country keys carry the workspace id and its payload size. Members without access to
    // that country must not enumerate them, so each one is checked against the same read
    // gate as a direct fetch. Non-country keys stay on the organisation-wide gate above.
    const rows = results || [];
    const countryKeys = [...new Set(rows.map((row) => row.data_key).filter((k) => String(k).startsWith("country:")))];
    const readable = new Set();
    for (const countryKey of countryKeys) {
      const gate = await verifyOrgCountryKvRead(env, authHeader, orgSlug, countryKey);
      if (gate.ok) readable.add(countryKey);
    }
    const items = rows.filter(
      (row) => !String(row.data_key).startsWith("country:") || readable.has(row.data_key),
    );
    return json({ ok: true, items }, 200, c);
  }

  if (!key) {
    return json({ error: "missing_key" }, 400, c);
  }

  const countryGate = await verifyOrgCountryKvRead(env, authHeader, orgSlug, key);
  if (!countryGate.ok) {
    return json({ error: countryGate.error || "forbidden" }, countryGate.error === "Unauthorized" ? 401 : 403, c);
  }

  const row = await env.DB.prepare(
    `SELECT value_json, version, updated_at FROM org_sync_kv
     WHERE org_slug = ? AND namespace = ? AND data_key = ?`
  )
    .bind(orgSlug, namespace, key)
    .first();

  if (!row) {
    return json({ ok: true, value: null, version: 0, updated_at: null }, 200, c);
  }
  let parsed;
  try {
    parsed = JSON.parse(row.value_json);
  } catch {
    return json({ error: "corrupt_value" }, 500, c);
  }
  return json({ ok: true, value: parsed, version: row.version, updated_at: row.updated_at }, 200, c);
}

async function handleKvPut(request, env, orgSlug, authHeader, c) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400, c);
  }
  const namespace = String(body.namespace || "").trim();
  const dataKey = String(body.key || "").trim();
  const ifVersion = body.ifVersion;
  if (!namespace || !dataKey) {
    return json({ error: "missing_namespace_or_key" }, 400, c);
  }
  if (!isValidD1Namespace(namespace)) {
    return json({ error: "invalid_namespace" }, 400, c);
  }
  const writeGate = await verifyOrgKvWrite(env, authHeader, orgSlug, namespace, dataKey);
  if (!writeGate.ok) {
    const status = writeGate.error === "Unauthorized" ? 401 : writeGate.error === "invalid_namespace" ? 400 : 403;
    return json({ error: writeGate.error || "forbidden" }, status, c);
  }
  const actorSub = parseJwtSub(authHeader);
  if (actorSub) {
    const allowed = await consumeRateLimit(env, `kv_put:${orgSlug}:${actorSub}`, KV_PUT_MAX_PER_MINUTE);
    if (!allowed) return json({ error: "rate_limited" }, 429, c);
  }
  if (dataKey.length > 256 || namespace.length > 128) {
    return json({ error: "key_too_long" }, 400, c);
  }

  const valueJson = JSON.stringify(body.value);
  if (valueJson.length > 4_500_000) {
    return json({ error: "payload_too_large" }, 413, c);
  }

  const now = new Date().toISOString();

  const existing = await env.DB.prepare(`SELECT version FROM org_sync_kv WHERE org_slug = ? AND namespace = ? AND data_key = ?`)
    .bind(orgSlug, namespace, dataKey)
    .first();

  if (ifVersion != null && Number.isFinite(ifVersion)) {
    const v = existing ? existing.version : 0;
    if (v !== ifVersion) {
      return json({ error: "version_conflict", expected: ifVersion, current: v }, 409, c);
    }
  }

  const nextVersion = existing ? existing.version + 1 : 1;
  await env.DB.prepare(
    `INSERT INTO org_sync_kv (org_slug, namespace, data_key, value_json, version, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(org_slug, namespace, data_key) DO UPDATE SET
       value_json = excluded.value_json,
       version = excluded.version,
       updated_at = excluded.updated_at`
  )
    .bind(orgSlug, namespace, dataKey, valueJson, nextVersion, now)
    .run();

  return json({ ok: true, version: nextVersion, updated_at: now }, 200, c);
}

async function handleKvDelete(request, env, orgSlug, c) {
  const url = new URL(request.url);
  const namespace = (url.searchParams.get("namespace") || "").trim();
  const dataKey = (url.searchParams.get("key") || "").trim();
  if (!namespace || !dataKey) {
    return json({ error: "missing_namespace_or_key" }, 400, c);
  }
  const r = await env.DB.prepare(`DELETE FROM org_sync_kv WHERE org_slug = ? AND namespace = ? AND data_key = ?`)
    .bind(orgSlug, namespace, dataKey)
    .run();
  return json({ ok: true, deleted: r.meta?.changes ?? 0 }, 200, c);
}

async function handleAuditAppend(request, env, orgSlug, authHeader, c) {
  const secret = env.AUDIT_CHAIN_SECRET;
  if (!secret || String(secret).length < 16) {
    return json({ error: "audit_not_configured" }, 503, c);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400, c);
  }
  const action = String(body.action || "").trim();
  const entity = String(body.entity || "").trim();
  if (!action || !entity) {
    return json({ error: "missing_action_or_entity" }, 400, c);
  }
  if (!isValidAuditField(action) || !isValidAuditField(entity)) {
    return json({ error: "invalid_action_or_entity" }, 400, c);
  }
  const detail = body.detail != null ? String(body.detail) : null;
  const clientRowId = body.client_row_id != null ? String(body.client_row_id) : null;
  const extra = body.extra && typeof body.extra === "object" ? body.extra : null;

  const createdAt = new Date().toISOString();
  const actorSub = parseJwtSub(authHeader);

  if (actorSub) {
    const allowed = await consumeRateLimit(env, `audit_append:${orgSlug}:${actorSub}`, AUDIT_APPEND_MAX_PER_MINUTE);
    if (!allowed) return json({ error: "rate_limited" }, 429, c);
  }

  const maxAttempts = 6;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const last = await env.DB.prepare(
      `SELECT seq, entry_hash FROM org_audit_log WHERE org_slug = ? ORDER BY seq DESC LIMIT 1`
    )
      .bind(orgSlug)
      .first();

    const prevHash = last?.entry_hash || GENESIS_HASH;
    const nextSeq = (last?.seq ?? 0) + 1;

    const payload = {
      seq: nextSeq,
      org_slug: orgSlug,
      created_at: createdAt,
      actor_sub: actorSub,
      action,
      entity,
      detail,
      client_row_id: clientRowId,
      extra,
    };
    const payloadJson = stableStringify(payload);
    if (payloadJson.length > 32_000) {
      return json({ error: "payload_too_large" }, 413, c);
    }

    const macInput = `${prevHash}\n${payloadJson}`;
    const entryHash = await hmacHex(secret, macInput);

    try {
      await env.DB.prepare(
        `INSERT INTO org_audit_log (org_slug, seq, created_at, actor_sub, action, entity, detail, client_row_id, payload_json, prev_hash, entry_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          orgSlug,
          nextSeq,
          createdAt,
          actorSub,
          action,
          entity,
          detail,
          clientRowId,
          payloadJson,
          prevHash,
          entryHash
        )
        .run();
      return json({ ok: true, seq: nextSeq, entry_hash: entryHash, created_at: createdAt }, 200, c);
    } catch (e) {
      const msg = e?.message || String(e);
      if (msg.includes("UNIQUE") && attempt < maxAttempts - 1) {
        continue;
      }
      if (msg.includes("UNIQUE")) {
        return json({ error: "concurrent_append_retry" }, 409, c);
      }
      return json({ error: "write_failed", detail: msg.slice(0, 120) }, 500, c);
    }
  }

  return json({ error: "concurrent_append_retry" }, 409, c);
}

async function handleAuditList(request, env, orgSlug, c) {
  const url = new URL(request.url);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")) || 50));
  const afterSeq = Math.max(0, Number(url.searchParams.get("after_seq")) || 0);

  const { results } = await env.DB.prepare(
    `SELECT id, seq, created_at, actor_sub, action, entity, detail, client_row_id, prev_hash, entry_hash, payload_json
     FROM org_audit_log WHERE org_slug = ? AND seq > ? ORDER BY seq ASC LIMIT ?`
  )
    .bind(orgSlug, afterSeq, limit)
    .all();

  return json({ ok: true, items: results || [] }, 200, c);
}

async function handleAuditVerify(env, orgSlug, c) {
  const secret = env.AUDIT_CHAIN_SECRET;
  if (!secret || String(secret).length < 16) {
    return json({ error: "audit_not_configured" }, 503, c);
  }

  const { results } = await env.DB.prepare(`SELECT * FROM org_audit_log WHERE org_slug = ? ORDER BY seq ASC`)
    .bind(orgSlug)
    .all();
  const rows = results || [];
  let expectedPrev = GENESIS_HASH;

  for (const row of rows) {
    if (row.prev_hash !== expectedPrev) {
      return json({ ok: false, error: "chain_broken", at_seq: row.seq, reason: "prev_mismatch" }, 200, c);
    }
    const mac = await hmacHex(secret, `${row.prev_hash}\n${row.payload_json}`);
    if (mac !== row.entry_hash) {
      return json({ ok: false, error: "chain_broken", at_seq: row.seq, reason: "hmac_mismatch" }, 200, c);
    }
    expectedPrev = row.entry_hash;
  }
  return json({ ok: true, entries: rows.length, head: expectedPrev }, 200, c);
}

export default {
  async fetch(request, env) {
    const requestId = crypto.randomUUID();
    const c = { ...corsHeaders(request, env), ...secHeaders(), "X-Request-Id": requestId };
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: c });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/v1/health" || path === "/health") {
      if (request.method !== "GET") {
        return json({ error: "method_not_allowed", request_id: requestId }, 405, c);
      }
      return handleHealth(c, requestId);
    }

    if (path === "/v1/audit/append" && request.method === "POST") {
      const auth = request.headers.get("Authorization") || "";
      const orgSlug = (request.headers.get("X-Org-Slug") || "").trim();
      if (!orgSlug) return json({ error: "missing_org_slug" }, 400, c);
      const gate = await verifyOrgCloudWrite(env, auth, orgSlug);
      if (!gate.ok) {
        const status = gate.error === "Unauthorized" ? 401 : 403;
        return json({ error: gate.error || "forbidden" }, status, c);
      }
      return handleAuditAppend(request, env, orgSlug, auth, c);
    }

    if (path === "/v1/audit" && request.method === "GET") {
      const auth = request.headers.get("Authorization") || "";
      const orgSlug = (request.headers.get("X-Org-Slug") || "").trim();
      if (!orgSlug) return json({ error: "missing_org_slug" }, 400, c);
      const gate = await verifyOrgAuditRead(env, auth, orgSlug);
      if (!gate.ok) {
        const status = gate.error === "Unauthorized" ? 401 : 403;
        return json({ error: gate.error || "forbidden", request_id: requestId }, status, c);
      }
      if (url.searchParams.get("verify") === "1") {
        return handleAuditVerify(env, orgSlug, c);
      }
      return handleAuditList(request, env, orgSlug, c);
    }

    if (path === "/v1/audit/verify" && request.method === "GET") {
      const auth = request.headers.get("Authorization") || "";
      const orgSlug = (request.headers.get("X-Org-Slug") || "").trim();
      if (!orgSlug) return json({ error: "missing_org_slug" }, 400, c);
      const gate = await verifyOrgAuditRead(env, auth, orgSlug);
      if (!gate.ok) {
        const status = gate.error === "Unauthorized" ? 401 : 403;
        return json({ error: gate.error || "forbidden", request_id: requestId }, status, c);
      }
      return handleAuditVerify(env, orgSlug, c);
    }

    if (!path.startsWith("/v1/kv")) {
      return json({ error: "not_found" }, 404, c);
    }

    const auth = request.headers.get("Authorization") || "";
    const orgSlug = (request.headers.get("X-Org-Slug") || "").trim();
    if (!orgSlug) {
      return json({ error: "missing_org_slug" }, 400, c);
    }

    if (request.method === "GET") {
      const gate = await verifyOrgAccess(env, auth, orgSlug);
      if (!gate.ok) {
        const status = gate.error === "Unauthorized" ? 401 : 403;
        return json({ error: gate.error || "forbidden" }, status, c);
      }
      return handleKvGet(request, env, orgSlug, c, auth);
    }
    if (request.method === "PUT") {
      const writeGate = await verifyOrgCloudWrite(env, auth, orgSlug);
      if (!writeGate.ok) {
        const status = writeGate.error === "Unauthorized" ? 401 : 403;
        return json({ error: writeGate.error || "forbidden" }, status, c);
      }
      return handleKvPut(request, env, orgSlug, auth, c);
    }
    if (request.method === "DELETE") {
      const writeGate = await verifyOrgCloudWrite(env, auth, orgSlug);
      if (!writeGate.ok) {
        const status = writeGate.error === "Unauthorized" ? 401 : 403;
        return json({ error: writeGate.error || "forbidden", request_id: requestId }, status, c);
      }
      const dataKey = (new URL(request.url).searchParams.get("key") || "").trim();
      const deleteGate = await verifyOrgKvDelete(env, auth, orgSlug, dataKey);
      if (!deleteGate.ok) {
        const status = deleteGate.error === "Unauthorized" ? 401 : 403;
        return json({ error: deleteGate.error || "forbidden", request_id: requestId }, status, c);
      }
      return handleKvDelete(request, env, orgSlug, c);
    }
    return json({ error: "method_not_allowed" }, 405, c);
  },
};
