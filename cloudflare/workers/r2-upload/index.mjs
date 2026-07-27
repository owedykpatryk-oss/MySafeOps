/**
 * R2 upload + authenticated object fetch for MySafeOps.
 * POST /upload — multipart form: file (required), key (optional path inside bucket)
 * GET  /object?key=… — stream object (Supabase JWT + org membership)
 * GET  /signed?key=…&exp=…&sig=… — short-lived HMAC URL (no Authorization header)
 * Auth: Supabase JWT required when SUPABASE_URL + SUPABASE_ANON_KEY are set.
 * Legacy X-Upload-Token only when Supabase auth env is unset (local/dev).
 */

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const KEY_RE = /^[\w./-]+$/;
const ORG_KEY_RE = /\/org_[\w-]+\//;
const ALLOWED_UPLOAD_EXT = /\.(pdf|png|jpe?g|gif|webp|docx?|xlsx?|csv|txt|zip|kml|kmz)$/i;
const BLOCKED_CONTENT_TYPES = new Set([
  "text/html",
  "application/xhtml+xml",
  "image/svg+xml",
  "text/javascript",
  "application/javascript",
  "application/x-javascript",
]);
const SIGNED_TTL_SEC = 60 * 60; // 1 hour

function contentTypeAllowed(fileName, contentType) {
  const name = String(fileName || "");
  if (!ALLOWED_UPLOAD_EXT.test(name)) return false;
  const ct = String(contentType || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (!ct || ct === "application/octet-stream") return true;
  if (BLOCKED_CONTENT_TYPES.has(ct)) return false;
  return true;
}

function timingSafeEqual(expected, received) {
  const a = String(expected ?? "");
  const b = String(received ?? "");
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

const rateLimitBuckets = new Map();
/** Best-effort per-isolate fallback when durable limit is unavailable. */
function checkMemoryRateLimit(key, max, windowMs) {
  const now = Date.now();
  let entry = rateLimitBuckets.get(key);
  if (!entry || now - entry.start > windowMs) {
    entry = { start: now, count: 0 };
    rateLimitBuckets.set(key, entry);
  }
  entry.count += 1;
  if (rateLimitBuckets.size > 5000) {
    for (const [k, v] of rateLimitBuckets) {
      if (now - v.start > windowMs) rateLimitBuckets.delete(k);
    }
  }
  return entry.count <= max;
}

/**
 * Durable rate limit via Supabase `claim_edge_rate_bucket` (service_role).
 * Set SUPABASE_SERVICE_ROLE_KEY on the worker — same Postgres buckets as Edge Functions.
 * Falls back to in-memory only when service role is unset (dev).
 */
async function checkRateLimit(env, key, max, windowMs) {
  const url = String(env.SUPABASE_URL || "").trim().replace(/\/$/, "");
  const serviceKey = String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (url && serviceKey) {
    try {
      const res = await fetch(`${url}/rest/v1/rpc/claim_edge_rate_bucket`, {
        method: "POST",
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          p_key: key,
          p_max: max,
          p_window_seconds: Math.max(1, Math.ceil(windowMs / 1000)),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        return data === true || data === "true";
      }
      // Fail closed for abuse-sensitive upload routes when RPC is misconfigured.
      console.warn("claim_edge_rate_bucket HTTP", res.status);
      return false;
    } catch (e) {
      console.warn("claim_edge_rate_bucket failed", e);
      return false;
    }
  }
  return checkMemoryRateLimit(key, max, windowMs);
}

function parseBearer(request) {
  const raw = String(request.headers.get("Authorization") || "").trim();
  if (!raw.toLowerCase().startsWith("bearer ")) return "";
  return raw.slice(7).trim();
}

async function verifySupabaseJwt(env, token) {
  const url = String(env.SUPABASE_URL || "").trim().replace(/\/$/, "");
  const anon = String(env.SUPABASE_ANON_KEY || "").trim();
  if (!url || !anon || !token) return null;
  try {
    const res = await fetch(`${url}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anon },
    });
    if (!res.ok) return null;
    const user = await res.json();
    return user?.id ? user : null;
  } catch {
    return null;
  }
}

function orgSlugFromStorageKey(key) {
  const m = String(key || "").match(/\/org_([\w-]+)\//);
  return m?.[1] ? m[1] : null;
}

async function verifyOrgSlugAccess(env, authHeader, orgSlug) {
  const url = String(env.SUPABASE_URL || "").trim().replace(/\/$/, "");
  const anon = String(env.SUPABASE_ANON_KEY || "").trim();
  if (!url || !anon || !orgSlug || !authHeader) {
    return { ok: false, error: "Server misconfiguration" };
  }
  if (orgSlug === "default") return { ok: true };

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
    return { ok: false, error: `Supabase error ${res.status}` };
  }

  const data = await res.json();
  const allowed = data === true || data === "true";
  return allowed ? { ok: true } : { ok: false, error: "Forbidden: not a member of this organisation" };
}

function clientIp(request) {
  return request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || "unknown";
}

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...extra },
  });
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const base = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Upload-Token, Authorization",
    "Access-Control-Max-Age": "86400",
  };
  if (!origin) return base;
  if (allowed.length === 0) {
    return { ...base, "Access-Control-Allow-Origin": "null" };
  }
  const allow = allowed.includes(origin) ? origin : null;
  return {
    ...base,
    "Access-Control-Allow-Origin": allow || "null",
    Vary: "Origin",
  };
}

function isOriginAllowed(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (allowed.length === 0) return !origin;
  if (!origin) return true;
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

function safeAttachmentFilename(key) {
  const base = String(key || "").split("/").pop() || "download";
  return base.replace(/[^\w.-]+/g, "_").slice(0, 180);
}

function signingSecret(env) {
  return String(env.SIGNING_SECRET || env.UPLOAD_TOKEN || "").trim();
}

async function hmacHex(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function signObjectKey(env, key, expSec) {
  const secret = signingSecret(env);
  if (!secret) return null;
  const payload = `${key}.${expSec}`;
  const sig = await hmacHex(secret, payload);
  return { exp: expSec, sig };
}

async function verifyObjectSignature(env, key, exp, sig) {
  const secret = signingSecret(env);
  if (!secret || !key || !exp || !sig) return false;
  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || expNum * 1000 < Date.now()) return false;
  const expected = await hmacHex(secret, `${key}.${expNum}`);
  return timingSafeEqual(expected, String(sig));
}

function validateObjectKey(key) {
  const k = String(key || "").replace(/^\/+/, "").slice(0, 900);
  if (!KEY_RE.test(k) || k.includes("..") || !ORG_KEY_RE.test(k)) return null;
  if (!ALLOWED_UPLOAD_EXT.test(k)) return null;
  return k;
}

async function streamObject(env, key, c, { disposition = "attachment" } = {}) {
  const obj = await env.BUCKET.get(key);
  if (!obj) return json({ error: "Not found" }, 404, c);
  const fileName = safeAttachmentFilename(key);
  const headers = {
    ...c,
    "Content-Type": obj.httpMetadata?.contentType || "application/octet-stream",
    "Content-Disposition": `${disposition}; filename="${fileName}"`,
    "Cache-Control": "private, max-age=60",
    "X-Content-Type-Options": "nosniff",
  };
  if (obj.size != null) headers["Content-Length"] = String(obj.size);
  return new Response(obj.body, { status: 200, headers });
}

export default {
  async fetch(request, env) {
    const c = corsHeaders(request, env);
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      if (!isOriginAllowed(request, env)) {
        return json({ error: "Origin not allowed" }, 403, c);
      }
      return new Response(null, { status: 204, headers: c });
    }

    if (request.method === "GET" && url.pathname.endsWith("/signed")) {
      const key = validateObjectKey(url.searchParams.get("key"));
      if (!key) return json({ error: "Invalid key" }, 400, c);
      const okSig = await verifyObjectSignature(
        env,
        key,
        url.searchParams.get("exp"),
        url.searchParams.get("sig")
      );
      if (!okSig) return json({ error: "Invalid or expired signature" }, 403, c);
      const ip = clientIp(request);
      if (!(await checkRateLimit(env, `signed:${ip}`, 120, 60_000))) {
        return json({ error: "Too many requests" }, 429, { ...c, "Retry-After": "60" });
      }
      return streamObject(env, key, c, { disposition: "inline" });
    }

    if (request.method === "GET" && url.pathname.endsWith("/object")) {
      if (!isOriginAllowed(request, env)) {
        return json({ error: "Origin not allowed" }, 403, c);
      }
      const ip = clientIp(request);
      if (!(await checkRateLimit(env, `get:${ip}`, 60, 60_000))) {
        return json({ error: "Too many requests" }, 429, { ...c, "Retry-After": "60" });
      }
      const key = validateObjectKey(url.searchParams.get("key"));
      if (!key) return json({ error: "Invalid key" }, 400, c);

      const hasSupabaseAuth = Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY);
      if (!hasSupabaseAuth) {
        return json({ error: "Object fetch requires Supabase auth on the Worker" }, 501, c);
      }
      const bearer = parseBearer(request);
      const sessionUser = bearer ? await verifySupabaseJwt(env, bearer) : null;
      if (!sessionUser) return json({ error: "Unauthorized — sign in required" }, 401, c);

      const orgSlug = orgSlugFromStorageKey(key);
      if (orgSlug) {
        const access = await verifyOrgSlugAccess(env, `Bearer ${bearer}`, orgSlug);
        if (!access.ok) return json({ error: access.error || "Forbidden" }, 403, c);
      }
      return streamObject(env, key, c, { disposition: "attachment" });
    }

    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405, c);
    }

    if (!isOriginAllowed(request, env)) {
      return json({ error: "Origin not allowed" }, 403, c);
    }

    if (!url.pathname.endsWith("/upload")) {
      return json({ error: "Not found" }, 404, c);
    }

    const ip = clientIp(request);
    if (!(await checkRateLimit(env, `auth:${ip}`, 30, 5 * 60_000))) {
      return json({ error: "Too many requests" }, 429, { ...c, "Retry-After": "60" });
    }

    const bearer = parseBearer(request);
    const sessionUser = bearer ? await verifySupabaseJwt(env, bearer) : null;
    const uploadToken = request.headers.get("X-Upload-Token") || "";
    const tokenOk = Boolean(env.UPLOAD_TOKEN && timingSafeEqual(env.UPLOAD_TOKEN, uploadToken));
    const hasSupabaseAuth = Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY);

    // When Supabase is configured, JWT is mandatory — legacy upload token is ignored.
    if (hasSupabaseAuth) {
      if (!sessionUser) {
        return json({ error: "Unauthorized — sign in required" }, 401, c);
      }
    } else if (!tokenOk) {
      return json({ error: "Unauthorized" }, 401, c);
    }

    if (!(await checkRateLimit(env, `upload:${ip}`, 15, 60_000))) {
      return json({ error: "Too many requests" }, 429, { ...c, "Retry-After": "60" });
    }

    let form;
    try {
      form = await request.formData();
    } catch {
      return json({ error: "Invalid form data" }, 400, c);
    }

    const file = form.get("file");
    if (!file || typeof file.stream !== "function") {
      return json({ error: "Missing file" }, 400, c);
    }

    if (Number(file.size) > MAX_UPLOAD_BYTES) {
      return json({ error: "File too large" }, 413, c);
    }

    if (!contentTypeAllowed(file.name || "", file.type || "")) {
      return json({ error: "File type not allowed" }, 415, c);
    }

    let key = form.get("key");
    if (!key || typeof key !== "string") {
      key = `uploads/${crypto.randomUUID()}-${file.name || "blob"}`;
    }
    key = key.replace(/^\/+/, "").slice(0, 900);
    if (!KEY_RE.test(key) || key.includes("..") || !ORG_KEY_RE.test(key)) {
      return json({ error: "Invalid key" }, 400, c);
    }
    if (!ALLOWED_UPLOAD_EXT.test(key)) {
      return json({ error: "File type not allowed" }, 415, c);
    }

    const orgSlug = orgSlugFromStorageKey(key);
    if (orgSlug) {
      if (!sessionUser || !bearer) {
        return json({ error: "Unauthorized — org uploads require sign-in" }, 401, c);
      }
      const access = await verifyOrgSlugAccess(env, `Bearer ${bearer}`, orgSlug);
      if (!access.ok) {
        return json({ error: access.error || "Forbidden" }, 403, c);
      }
    }

    const fileName = safeAttachmentFilename(key);
    await env.BUCKET.put(key, file.stream(), {
      httpMetadata: {
        contentType: file.type || "application/octet-stream",
        contentDisposition: `attachment; filename="${fileName}"`,
      },
    });

    const exp = Math.floor(Date.now() / 1000) + SIGNED_TTL_SEC;
    const signed = await signObjectKey(env, key, exp);
    const signedUrl = signed
      ? `${url.origin}/signed?key=${encodeURIComponent(key)}&exp=${signed.exp}&sig=${signed.sig}`
      : null;

    return json({ ok: true, key, size: file.size, signedUrl, signedExpiresAt: signed ? exp : null }, 200, c);
  },
};
