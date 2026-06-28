/**
 * POST /upload — multipart form: file (required), key (optional path inside bucket)
 * Header: X-Upload-Token must match secret UPLOAD_TOKEN
 */

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
  if (!origin || allowed.length === 0) {
    return {
      ...(origin ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {}),
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Upload-Token",
      "Access-Control-Max-Age": "86400",
    };
  }
  const allow = allowed.includes(origin) ? origin : null;
  return {
    "Access-Control-Allow-Origin": allow || "null",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Upload-Token",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export default {
  async fetch(request, env) {
    const c = corsHeaders(request, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: c });
    }

    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405, c);
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

    let key = form.get("key");
    if (!key || typeof key !== "string") {
      key = `uploads/${crypto.randomUUID()}-${file.name || "blob"}`;
    }
    key = key.replace(/^\/+/, "").slice(0, 900);
    if (!/^[\w./-]+$/.test(key) || key.includes("..")) {
      return json({ error: "Invalid key" }, 400, c);
    }

    await env.BUCKET.put(key, file.stream(), {
      httpMetadata: { contentType: file.type || "application/octet-stream" },
    });

    return json({ ok: true, key, size: file.size }, 200, c);
  },
};
