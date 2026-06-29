/**
 * Anthropic Messages API from the browser.
 * - Direct: VITE_ANTHROPIC_API_KEY (ships in bundle — dev only recommended).
 * - Production: set VITE_ANTHROPIC_PROXY_URL=/api/anthropic-messages and ANTHROPIC_API_KEY on Vercel (see api/anthropic-messages.js).
 */

let warnedClientKeyInProd = false;
let proxyReadyCache = null;
let proxyReadyReason = null;

const PROXY_ERROR_MESSAGES = {
  anthropic_not_configured:
    "AI is not configured on the server. Add ANTHROPIC_API_KEY to Vercel environment variables.",
  ai_proxy_secret_required:
    "AI proxy secret is missing on the server. Add AI_PROXY_SHARED_SECRET on Vercel and matching VITE_AI_PROXY_SECRET in the production build.",
  unauthorized:
    "AI proxy secret mismatch. Ensure VITE_AI_PROXY_SECRET matches AI_PROXY_SHARED_SECRET on Vercel.",
  forbidden_origin: "AI proxy rejected this request (origin check failed).",
  invalid_json: "AI proxy received invalid JSON.",
  invalid_body: "AI proxy rejected the request body.",
  payload_too_large: "AI request is too large for the proxy.",
  upstream_unreachable: "Could not reach Anthropic from the server. Try again shortly.",
  method_not_allowed: "AI proxy method not allowed.",
};

export function getAnthropicKey() {
  const k = import.meta.env.VITE_ANTHROPIC_API_KEY || "";
  if (import.meta.env.PROD && k && !warnedClientKeyInProd && !isAnthropicProxyConfigured()) {
    warnedClientKeyInProd = true;
    console.warn(
      "[MySafeOps] VITE_ANTHROPIC_API_KEY is in the production bundle. Prefer VITE_ANTHROPIC_PROXY_URL + server ANTHROPIC_API_KEY."
    );
  }
  return k;
}

export function getAnthropicModel() {
  return import.meta.env.VITE_ANTHROPIC_MODEL || "claude-sonnet-4-6";
}

function isAnthropicProxyConfigured() {
  return Boolean(String(import.meta.env.VITE_ANTHROPIC_PROXY_URL || "").trim());
}

/** True if direct API key or same-origin proxy URL is set in the client build. */
export function isAnthropicConfigured() {
  return isAnthropicProxyConfigured() || Boolean(String(import.meta.env.VITE_ANTHROPIC_API_KEY || "").trim());
}

function resolveAnthropicMessagesUrl() {
  const proxy = String(import.meta.env.VITE_ANTHROPIC_PROXY_URL || "").trim();
  if (!proxy) return "https://api.anthropic.com/v1/messages";
  if (import.meta.env.PROD && (proxy.startsWith("http://") || proxy.startsWith("https://"))) {
    throw new Error("External AI proxy URLs are disabled in production. Use a same-origin path such as /api/anthropic-messages.");
  }
  if (proxy.startsWith("http://") || proxy.startsWith("https://")) return proxy.replace(/\/$/, "");
  const path = proxy.startsWith("/") ? proxy : `/${proxy}`;
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}${path}`;
  }
  return path;
}

function formatAnthropicApiError(res, json) {
  const upstream = json?.error?.message || json?.message;
  if (upstream && typeof upstream === "string") return upstream;

  const code =
    typeof json?.error === "string"
      ? json.error
      : typeof json?.error?.type === "string"
        ? json.error.type
        : typeof json?.reason === "string"
          ? json.reason
          : null;

  if (code && PROXY_ERROR_MESSAGES[code]) return PROXY_ERROR_MESSAGES[code];
  if (res.status === 503) {
    return "AI service is unavailable. Check Vercel env: ANTHROPIC_API_KEY, AI_PROXY_SHARED_SECRET, and VITE_AI_PROXY_SECRET.";
  }
  if (res.status === 401) return PROXY_ERROR_MESSAGES.unauthorized;
  return res.statusText || "API error";
}

/** Probe same-origin AI proxy readiness (cached). Direct API key mode always returns true. */
export async function checkAnthropicProxyReady({ force = false } = {}) {
  if (!isAnthropicProxyConfigured()) {
    return Boolean(String(import.meta.env.VITE_ANTHROPIC_API_KEY || "").trim());
  }
  if (!force && proxyReadyCache !== null) return proxyReadyCache;
  try {
    const res = await fetch(resolveAnthropicMessagesUrl(), {
      method: "GET",
      credentials: "same-origin",
    });
    const json = await res.json().catch(() => ({}));
    proxyReadyCache = res.ok && json?.configured !== false;
    proxyReadyReason = typeof json?.reason === "string" ? json.reason : null;
  } catch {
    proxyReadyCache = false;
  }
  return proxyReadyCache;
}

async function ensureAnthropicProxyReady() {
  if (!isAnthropicProxyConfigured()) return;
  const ready = await checkAnthropicProxyReady();
  if (!ready) {
    const reasonMsg =
      proxyReadyReason && PROXY_ERROR_MESSAGES[proxyReadyReason]
        ? PROXY_ERROR_MESSAGES[proxyReadyReason]
        : "AI service is unavailable. Check Vercel env: ANTHROPIC_API_KEY, AI_PROXY_SHARED_SECRET, and VITE_AI_PROXY_SECRET.";
    throw new Error(reasonMsg);
  }
}

async function postAnthropicMessagesBody(body) {
  const useProxy = isAnthropicProxyConfigured();
  if (import.meta.env.PROD && !useProxy && getAnthropicKey()) {
    throw new Error(
      "Direct Anthropic API keys are disabled in production. Set VITE_ANTHROPIC_PROXY_URL=/api/anthropic-messages and configure server secrets."
    );
  }
  if (useProxy) await ensureAnthropicProxyReady();

  const url = resolveAnthropicMessagesUrl();

  const headers = {
    "Content-Type": "application/json",
    "anthropic-version": "2023-06-01",
  };

  if (!useProxy) {
    const apiKey = getAnthropicKey();
    if (!apiKey) {
      throw new Error(
        "Missing VITE_ANTHROPIC_API_KEY. For production set VITE_ANTHROPIC_PROXY_URL=/api/anthropic-messages and ANTHROPIC_API_KEY on the server."
      );
    }
    headers["x-api-key"] = apiKey;
  } else {
    const secret = String(import.meta.env.VITE_AI_PROXY_SECRET || "").trim();
    if (secret) headers["x-mysafeops-ai-secret"] = secret;
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (useProxy && (res.status === 503 || res.status === 401)) {
      proxyReadyCache = false;
    }
    throw new Error(formatAnthropicApiError(res, json));
  }
  if (useProxy) proxyReadyCache = true;
  return json;
}

export async function anthropicMessages({ system, messages, maxTokens = 4096 }) {
  const json = await postAnthropicMessagesBody({
    model: getAnthropicModel(),
    max_tokens: maxTokens,
    system: system || undefined,
    messages,
  });
  const block = json?.content?.find((c) => c.type === "text");
  return block?.text || "";
}

/**
 * Vision + text (single user message with image block).
 */
export async function anthropicVision({ prompt, base64, mediaType }) {
  const json = await postAnthropicMessagesBody({
    model: getAnthropicModel(),
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
          { type: "text", text: prompt },
        ],
      },
    ],
  });
  const block = json?.content?.find((c) => c.type === "text");
  return block?.text || "";
}
