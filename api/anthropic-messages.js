/**
 * Vercel Node serverless: forwards Anthropic Messages API using server-only ANTHROPIC_API_KEY.
 * Client: set VITE_ANTHROPIC_PROXY_URL=/api/anthropic-messages (see .env.example).
 *
 * Production: ANTHROPIC_API_KEY + AI_PROXY_SHARED_SECRET (required) + matching VITE_AI_PROXY_SECRET in the client.
 */

import {
  API_JSON_HEADERS,
  clampAnthropicBody,
  isSameSiteApiRequest,
  isVercelProduction,
  normalizeAnthropicVersion,
  readJsonBody,
  sendJson,
  timingSafeEqual,
} from "./securityUtils.js";

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
  const production = isVercelProduction();
  if (!apiKey) {
    return { ok: false, configured: false, reason: "anthropic_not_configured" };
  }
  if (production && !shared) {
    return { ok: false, configured: false, reason: "ai_proxy_secret_required" };
  }
  return { ok: true, configured: true, reason: null };
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
      "Access-Control-Allow-Headers": "Content-Type, anthropic-version, x-mysafeops-ai-secret",
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

  const shared = String(process.env.AI_PROXY_SHARED_SECRET || "").trim();
  if (isVercelProduction() && !shared) {
    return sendJson(res, 503, { error: "ai_proxy_secret_required" });
  }
  if (shared) {
    const got = String(req.headers["x-mysafeops-ai-secret"] || "").trim();
    if (!timingSafeEqual(shared, got)) {
      return sendJson(res, 401, { error: "unauthorized" });
    }
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
