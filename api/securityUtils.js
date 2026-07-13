import crypto from "node:crypto";

export const API_JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
  "Cache-Control": "no-store",
  "Cross-Origin-Resource-Policy": "same-site",
};

export function sendJson(res, status, obj, extraHeaders = {}) {
  res.writeHead(status, { ...API_JSON_HEADERS, ...extraHeaders });
  res.end(JSON.stringify(obj));
}

export function isProductionEnv() {
  const vercel = String(process.env.VERCEL_ENV || "").trim().toLowerCase();
  if (vercel === "production") return true;
  return String(process.env.NODE_ENV || "").trim().toLowerCase() === "production";
}

/** Vercel production deployment only (excludes preview/staging). */
export function isVercelProduction() {
  return String(process.env.VERCEL_ENV || "").trim().toLowerCase() === "production";
}

/** Constant-time string compare (UTF-8). */
export function timingSafeEqual(expected, received) {
  const a = String(expected ?? "");
  const b = String(received ?? "");
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
  } catch {
    return false;
  }
}

export async function readJsonBody(req, maxBytes) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    return req.body;
  }
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes) {
      return { __body_too_large: true };
    }
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const WEB_VITALS_METRICS = new Set(["CLS", "INP", "LCP", "FCP", "TTFB", "FID"]);

export function sanitizeWebVitalsPayload(parsed) {
  if (!parsed || typeof parsed !== "object") return null;
  const name = String(parsed.name || parsed.metric || "").trim().toUpperCase();
  if (!WEB_VITALS_METRICS.has(name)) return null;
  const valueRaw = typeof parsed.value === "number" ? parsed.value : parsed.delta;
  const value = typeof valueRaw === "number" && Number.isFinite(valueRaw) ? valueRaw : null;
  if (value == null) return null;
  const id = String(parsed.id || "")
    .replace(/[^\w-]/g, "")
    .slice(0, 64);
  const path = String(parsed.path || "")
    .replace(/[\0\r\n]/g, "")
    .slice(0, 512);
  return { name, value, id, path };
}

const ANTHROPIC_VERSIONS = new Set(["2023-06-01", "2023-01-01"]);

export function normalizeAnthropicVersion(headerValue) {
  const v = String(headerValue || "2023-06-01").trim();
  return ANTHROPIC_VERSIONS.has(v) ? v : "2023-06-01";
}

export function clampAnthropicBody(body) {
  if (!body || typeof body !== "object") return null;
  if (!body.model || !Array.isArray(body.messages)) return null;
  if (body.messages.length > 64) return null;
  const maxTokens = Number(body.max_tokens);
  if (Number.isFinite(maxTokens)) {
    body.max_tokens = Math.min(Math.max(1, Math.floor(maxTokens)), 8192);
  }
  return body;
}

/** Reject cross-origin browser calls to serverless API routes (CSRF-style abuse). */
export function isSameSiteApiRequest(req) {
  const origin = String(req.headers?.origin || "").trim();
  const host = String(req.headers?.host || "").trim();
  if (origin) {
    if (!host) return false;
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }
  const secFetchSite = String(req.headers?.["sec-fetch-site"] || "").trim().toLowerCase();
  if (secFetchSite === "same-origin" || secFetchSite === "same-site") return true;
  // curl/server-side abuse often omits Origin — block in production, allow local dev tools.
  if (isProductionEnv()) return false;
  return true;
}

/**
 * Best-effort client IP for rate limiting. Vercel sets x-forwarded-for /
 * x-real-ip on the edge; falls back to the raw socket for local dev.
 */
export function getClientIp(req) {
  const xff = String(req.headers?.["x-forwarded-for"] || "").trim();
  if (xff) return xff.split(",")[0].trim();
  const real = String(req.headers?.["x-real-ip"] || "").trim();
  if (real) return real;
  return String(req.socket?.remoteAddress || "unknown");
}

const rateLimitBuckets = new Map();
let rateLimitLastSweep = 0;

/**
 * In-memory sliding-window rate limiter, keyed by caller-supplied string
 * (e.g. `${route}:${ip}`). Best-effort only — serverless/edge functions may
 * run in multiple isolates, so this bounds *sustained* abuse from a single
 * warm instance rather than providing a hard global cap. Important as a
 * second layer of defence because client-shipped shared secrets (VITE_*)
 * are not truly secret once the bundle is public.
 */
export function checkRateLimit(key, { max = 20, windowMs = 60_000 } = {}) {
  const now = Date.now();
  if (now - rateLimitLastSweep > windowMs) {
    for (const [k, entry] of rateLimitBuckets) {
      if (now - entry.start > windowMs) rateLimitBuckets.delete(k);
    }
    rateLimitLastSweep = now;
  }
  let entry = rateLimitBuckets.get(key);
  if (!entry || now - entry.start > windowMs) {
    entry = { start: now, count: 0 };
    rateLimitBuckets.set(key, entry);
  }
  entry.count += 1;
  const remainingMs = Math.max(0, windowMs - (now - entry.start));
  if (entry.count > max) {
    return { allowed: false, retryAfterSeconds: Math.ceil(remainingMs / 1000) };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Returns true when the request was rate-limited (response already sent). */
export function rejectIfRateLimited(req, res, routeKey, { max = 20, windowMs = 60_000 } = {}) {
  const clientIp = getClientIp(req);
  const usage = checkRateLimit(`${routeKey}:${clientIp}`, { max, windowMs });
  if (!usage.allowed) {
    res.setHeader("Retry-After", String(usage.retryAfterSeconds));
    sendJson(res, 429, { error: "rate_limited" });
    return true;
  }
  return false;
}

/** Parse upstream JSON with a byte cap — blocks proxy SSRF response bombs. */
export function parseBoundedJson(text, maxBytes = 65_536) {
  const raw = String(text ?? "");
  if (raw.length > maxBytes) return { error: "too_large" };
  if (!raw.trim()) return { value: null };
  try {
    return { value: JSON.parse(raw) };
  } catch {
    return { error: "invalid_json" };
  }
}
