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
  if (!origin) return true;
  const host = String(req.headers?.host || "").trim();
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
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
