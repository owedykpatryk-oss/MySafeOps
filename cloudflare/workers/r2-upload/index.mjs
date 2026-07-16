/**
 * POST /upload — multipart form: file (required), key (optional path inside bucket)
 * Auth: Supabase JWT (preferred when SUPABASE_URL + SUPABASE_ANON_KEY are set) or legacy X-Upload-Token.
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

// X-Upload-Token ships inside the client bundle (VITE_STORAGE_UPLOAD_TOKEN),
// so it isn't a true secret once deployed. This isolate-local sliding-window
// limiter bounds sustained abuse (bad-token brute force and storage-cost
// abuse with a valid token) as a second layer of defence.
const rateLimitBuckets = new Map();
function checkRateLimit(key, max, windowMs) {
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
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Upload-Token, Authorization",
    "Access-Control-Max-Age": "86400",
  };
  // Fail closed for browsers when ALLOWED_ORIGINS is unset — never echo '*'.
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
  // Fail closed when allowlist is unset — never accept arbitrary browser Origins.
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

export default {
  async fetch(request, env) {
    const c = corsHeaders(request, env);

    if (request.method === "OPTIONS") {
      if (!isOriginAllowed(request, env)) {
        return json({ error: "Origin not allowed" }, 403, c);
      }
      return new Response(null, { status: 204, headers: c });
    }

    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405, c);
    }

    if (!isOriginAllowed(request, env)) {
      return json({ error: "Origin not allowed" }, 403, c);
    }

    const url = new URL(request.url);
    if (!url.pathname.endsWith("/upload")) {
      return json({ error: "Not found" }, 404, c);
    }

    const ip = clientIp(request);
    if (!checkRateLimit(`auth:${ip}`, 30, 5 * 60_000)) {
      return json({ error: "Too many requests" }, 429, { ...c, "Retry-After": "60" });
    }

    const bearer = parseBearer(request);
    const sessionUser = bearer ? await verifySupabaseJwt(env, bearer) : null;
    const uploadToken = request.headers.get("X-Upload-Token") || "";
    const tokenOk = Boolean(env.UPLOAD_TOKEN && timingSafeEqual(env.UPLOAD_TOKEN, uploadToken));
    const hasSupabaseAuth = Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY);

    if (hasSupabaseAuth) {
      if (!sessionUser) {
        return json({ error: "Unauthorized — sign in required" }, 401, c);
      }
    } else if (!tokenOk) {
      return json({ error: "Unauthorized" }, 401, c);
    }

    if (!checkRateLimit(`upload:${ip}`, 15, 60_000)) {
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
    // Key may override the client file name — still require a safe extension on the object path.
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

    await env.BUCKET.put(key, file.stream(), {
      httpMetadata: { contentType: file.type || "application/octet-stream" },
    });

    return json({ ok: true, key, size: file.size }, 200, c);
  },
};
