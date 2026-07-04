/**
 * POST /upload — multipart form: file (required), key (optional path inside bucket)
 * Header: X-Upload-Token must match secret UPLOAD_TOKEN
 */

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const KEY_RE = /^[\w./-]+$/;
const ORG_KEY_RE = /\/org_[\w-]+\//;

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
    "Access-Control-Allow-Headers": "Content-Type, X-Upload-Token",
    "Access-Control-Max-Age": "86400",
  };
  if (allowed.length === 0) {
    return base;
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
  if (allowed.length === 0) return true;
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

    const token = request.headers.get("X-Upload-Token") || "";
    if (!env.UPLOAD_TOKEN || !timingSafeEqual(env.UPLOAD_TOKEN, token)) {
      return json({ error: "Unauthorized" }, 401, c);
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

    let key = form.get("key");
    if (!key || typeof key !== "string") {
      key = `uploads/${crypto.randomUUID()}-${file.name || "blob"}`;
    }
    key = key.replace(/^\/+/, "").slice(0, 900);
    if (!KEY_RE.test(key) || key.includes("..") || !ORG_KEY_RE.test(key)) {
      return json({ error: "Invalid key" }, 400, c);
    }

    await env.BUCKET.put(key, file.stream(), {
      httpMetadata: { contentType: file.type || "application/octet-stream" },
    });

    return json({ ok: true, key, size: file.size }, 200, c);
  },
};
