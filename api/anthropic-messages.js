/**
 * Vercel Node serverless: forwards Anthropic Messages API using server-only ANTHROPIC_API_KEY.
 * Client: set VITE_ANTHROPIC_PROXY_URL=/api/anthropic-messages (see .env.example).
 *
 * Vercel: ANTHROPIC_API_KEY (required). Optional AI_PROXY_SHARED_SECRET + matching VITE_AI_PROXY_SECRET in the client.
 */

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

const API_JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
  "Cache-Control": "no-store",
};

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, API_JSON_HEADERS);
  res.end(body);
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    return req.body;
  }
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_JSON_BYTES) {
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

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, anthropic-version, x-mysafeops-ai-secret",
      "Access-Control-Max-Age": "86400",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    });
    return res.end();
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }

  const shared = String(process.env.AI_PROXY_SHARED_SECRET || "").trim();
  if (shared) {
    const got = String(req.headers["x-mysafeops-ai-secret"] || "").trim();
    if (got !== shared) {
      return sendJson(res, 401, { error: "unauthorized" });
    }
  }

  const apiKey = String(process.env.ANTHROPIC_API_KEY || "").trim();
  if (!apiKey) {
    return sendJson(res, 503, { error: "anthropic_not_configured" });
  }

  const parsed = await readJsonBody(req);
  if (parsed?.__body_too_large) {
    return sendJson(res, 413, { error: "payload_too_large" });
  }
  if (parsed === null) {
    return sendJson(res, 400, { error: "invalid_json" });
  }

  const body = pickAnthropicBody(parsed);
  if (!body.model || !Array.isArray(body.messages)) {
    return sendJson(res, 400, { error: "invalid_body" });
  }

  const anthropicVersion = String(req.headers["anthropic-version"] || "2023-06-01");

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
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store",
  });
  return res.end(text);
}
