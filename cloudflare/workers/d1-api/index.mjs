/**
 * MySafeOps D1 API — org-scoped JSON key/value + append-only hash-chained audit.
 *
 * Auth: Authorization: Bearer <Supabase user JWT>
 *       X-Org-Slug: <organisations.slug> (membership via Supabase RPC)
 *
 * GET  /v1/health
 * GET  /v1/kv?namespace=&key=   |  ?namespace=&list=1
 * PUT  /v1/kv  JSON { namespace, key, value, ifVersion? }
 * DELETE /v1/kv?namespace=&key=
 * POST /v1/audit/append  JSON { action, entity, detail?, client_row_id?, extra? }
 * GET  /v1/audit?limit=50&after_seq=0
 * GET  /v1/audit/verify  (recomputes chain; use sparingly on large orgs)
 */

const GENESIS_HASH = "0".repeat(64);

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...extra },
  });
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const allow = allowed.length === 0 ? "*" : allowed.includes(origin) ? origin : allowed[0] || "*";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, PUT, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Org-Slug",
    "Access-Control-Max-Age": "86400",
  };
}

function secHeaders() {
  return {
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store",
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

function handleHealth(c) {
  return json({ ok: true, service: "mysafeops-d1-api" }, 200, c);
}

async function handleKvGet(request, env, orgSlug, c) {
  const url = new URL(request.url);
  const namespace = (url.searchParams.get("namespace") || "").trim();
  const key = (url.searchParams.get("key") || "").trim();
  const list = url.searchParams.get("list") === "1";
  if (!namespace) {
    return json({ error: "missing_namespace" }, 400, c);
  }

  if (list) {
    const { results } = await env.DB.prepare(
      `SELECT data_key, version, updated_at, LENGTH(value_json) AS value_bytes
       FROM org_sync_kv WHERE org_slug = ? AND namespace = ?`
    )
      .bind(orgSlug, namespace)
      .all();
    return json({ ok: true, items: results || [] }, 200, c);
  }

  if (!key) {
    return json({ error: "missing_key" }, 400, c);
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

async function handleKvPut(request, env, orgSlug, c) {
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
  const detail = body.detail != null ? String(body.detail) : null;
  const clientRowId = body.client_row_id != null ? String(body.client_row_id) : null;
  const extra = body.extra && typeof body.extra === "object" ? body.extra : null;

  const createdAt = new Date().toISOString();
  const actorSub = parseJwtSub(authHeader);

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
  } catch (e) {
    const msg = e?.message || String(e);
    if (msg.includes("UNIQUE")) {
      return json({ error: "concurrent_append_retry" }, 409, c);
    }
    return json({ error: "write_failed", detail: msg.slice(0, 120) }, 500, c);
  }

  return json({ ok: true, seq: nextSeq, entry_hash: entryHash, created_at: createdAt }, 200, c);
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
    const c = { ...corsHeaders(request, env), ...secHeaders() };
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: c });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/v1/health" || path === "/health") {
      if (request.method !== "GET") {
        return json({ error: "method_not_allowed" }, 405, c);
      }
      return handleHealth(c);
    }

    if (path === "/v1/audit/append" && request.method === "POST") {
      const auth = request.headers.get("Authorization") || "";
      const orgSlug = (request.headers.get("X-Org-Slug") || "").trim();
      if (!orgSlug) return json({ error: "missing_org_slug" }, 400, c);
      const gate = await verifyOrgAccess(env, auth, orgSlug);
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
      const gate = await verifyOrgAccess(env, auth, orgSlug);
      if (!gate.ok) {
        const status = gate.error === "Unauthorized" ? 401 : 403;
        return json({ error: gate.error || "forbidden" }, status, c);
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
      const gate = await verifyOrgAccess(env, auth, orgSlug);
      if (!gate.ok) {
        const status = gate.error === "Unauthorized" ? 401 : 403;
        return json({ error: gate.error || "forbidden" }, status, c);
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
    const gate = await verifyOrgAccess(env, auth, orgSlug);
    if (!gate.ok) {
      const status = gate.error === "Unauthorized" ? 401 : 403;
      return json({ error: gate.error || "forbidden" }, status, c);
    }

    if (request.method === "GET") {
      return handleKvGet(request, env, orgSlug, c);
    }
    if (request.method === "PUT") {
      return handleKvPut(request, env, orgSlug, c);
    }
    if (request.method === "DELETE") {
      return handleKvDelete(request, env, orgSlug, c);
    }
    return json({ error: "method_not_allowed" }, 405, c);
  },
};
