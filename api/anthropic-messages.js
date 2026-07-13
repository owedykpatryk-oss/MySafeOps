/**
 * Vercel Node serverless: forwards Anthropic Messages API using server-only ANTHROPIC_API_KEY.
 * Client: set VITE_ANTHROPIC_PROXY_URL=/api/anthropic-messages (see .env.example).
 *
 * Production: ANTHROPIC_API_KEY + valid Supabase session JWT (shared secret is dev-only fallback).
 */

import {
  API_JSON_HEADERS,
  checkRateLimit,
  clampAnthropicBody,
  getClientIp,
  isSameSiteApiRequest,
  isVercelProduction,
  normalizeAnthropicVersion,
  readJsonBody,
  sendJson,
  timingSafeEqual,
} from "./securityUtils.js";
import { parseBearerToken, verifySupabaseAccessToken } from "./verifySupabaseAuth.js";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MAX_JSON_BYTES = 512_000;
const ALLOWED_BODY_KEYS = new Set(["model", "max_tokens", "system", "messages"]);

function pickAnthropicBody(obj) {
  if (!obj || typeof obj !== "object") return {};
  const out = {};
  for (const k of ALLOWED_BODY_KEYS) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) out[k] = obj[k];
  }
  return out;
}

function anthropicProxyHealth() {
  const apiKey = Boolean(String(process.env.ANTHROPIC_API_KEY || "").trim());
  const shared = Boolean(String(process.env.AI_PROXY_SHARED_SECRET || "").trim());
  const supabaseAuth = Boolean(
    String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim()
    && String(process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "").trim()
  );
  const production = isVercelProduction();
  if (!apiKey) {
    return { ok: false, configured: false, reason: "anthropic_not_configured" };
  }
  if (production && !shared && !supabaseAuth) {
    return { ok: false, configured: false, reason: "ai_proxy_auth_required" };
  }
  return { ok: true, configured: true, reason: null, supabaseJwt: supabaseAuth, sharedSecret: shared };
}

export default async function handler(req, res) {
  if (req.method === "GET" || req.method === "HEAD") {
    const health = anthropicProxyHealth();
    res.writeHead(health.ok ? 200 : 503, API_JSON_HEADERS);
    if (req.method === "HEAD") return res.end();
    return res.end(JSON.stringify(health));
  }

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, anthropic-version, x-mysafeops-ai-secret, Authorization",
      "Access-Control-Max-Age": "86400",
      ...API_JSON_HEADERS,
    });
    return res.end();
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }

  if (!isSameSiteApiRequest(req)) {
    return sendJson(res, 403, { error: "forbidden_origin" });
  }

  const clientIp = getClientIp(req);

  // VITE_AI_PROXY_SECRET ships inside the client bundle, so it cannot be
  // treated as a true secret once deployed — rate limit both bad-secret
  // attempts (brute force) and successful calls (cost/abuse ceiling) per IP.
  const authAttempt = checkRateLimit(`anthropic:auth:${clientIp}`, { max: 30, windowMs: 5 * 60_000 });
  if (!authAttempt.allowed) {
    res.setHeader("Retry-After", String(authAttempt.retryAfterSeconds));
    return sendJson(res, 429, { error: "rate_limited" });
  }

  const shared = String(process.env.AI_PROXY_SHARED_SECRET || "").trim();
  const bearer = parseBearerToken(req);
  const sessionUser = bearer ? await verifySupabaseAccessToken(bearer) : null;
  const gotSecret = String(req.headers["x-mysafeops-ai-secret"] || "").trim();
  const secretOk = Boolean(shared && timingSafeEqual(shared, gotSecret));

  if (isVercelProduction()) {
    if (!sessionUser) {
      return sendJson(res, 401, {
        error: bearer ? "invalid_session" : "unauthorized",
      });
    }
  } else if (shared && !secretOk && !sessionUser) {
    return sendJson(res, 401, { error: "unauthorized" });
  }

  const usage = checkRateLimit(`anthropic:calls:${clientIp}`, { max: 20, windowMs: 60_000 });
  if (!usage.allowed) {
    res.setHeader("Retry-After", String(usage.retryAfterSeconds));
    return sendJson(res, 429, { error: "rate_limited" });
  }

  const apiKey = String(process.env.ANTHROPIC_API_KEY || "").trim();
  if (!apiKey) {
    return sendJson(res, 503, { error: "anthropic_not_configured" });
  }

  const parsed = await readJsonBody(req, MAX_JSON_BYTES);
  if (parsed?.__body_too_large) {
    return sendJson(res, 413, { error: "payload_too_large" });
  }
  if (parsed === null) {
    return sendJson(res, 400, { error: "invalid_json" });
  }

  const body = clampAnthropicBody(pickAnthropicBody(parsed));
  if (!body) {
    return sendJson(res, 400, { error: "invalid_body" });
  }

  const anthropicVersion = normalizeAnthropicVersion(req.headers["anthropic-version"]);

  let upstream;
  try {
    upstream = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": anthropicVersion,
      },
      body: JSON.stringify(body),
    });
  } catch {
    return sendJson(res, 502, { error: "upstream_unreachable" });
  }

  const text = await upstream.text();
  const ct = upstream.headers.get("content-type") || "application/json";
  res.writeHead(upstream.status, {
    "Content-Type": ct,
    ...API_JSON_HEADERS,
  });
  return res.end(text);
}
