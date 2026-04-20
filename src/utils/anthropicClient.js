/**
 * Anthropic Messages API from the browser.
 * - Direct: VITE_ANTHROPIC_API_KEY (ships in bundle — dev only recommended).
 * - Production: set VITE_ANTHROPIC_PROXY_URL=/api/anthropic-messages and ANTHROPIC_API_KEY on Vercel (see api/anthropic-messages.js).
 */

let warnedClientKeyInProd = false;

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
  return import.meta.env.VITE_ANTHROPIC_MODEL || "claude-sonnet-4-20250514";
}

function isAnthropicProxyConfigured() {
  return Boolean(String(import.meta.env.VITE_ANTHROPIC_PROXY_URL || "").trim());
}

/** True if direct API key or same-origin proxy is configured. */
export function isAnthropicConfigured() {
  return isAnthropicProxyConfigured() || Boolean(String(import.meta.env.VITE_ANTHROPIC_API_KEY || "").trim());
}

function resolveAnthropicMessagesUrl() {
  const proxy = String(import.meta.env.VITE_ANTHROPIC_PROXY_URL || "").trim();
  if (!proxy) return "https://api.anthropic.com/v1/messages";
  if (proxy.startsWith("http://") || proxy.startsWith("https://")) return proxy.replace(/\/$/, "");
  const path = proxy.startsWith("/") ? proxy : `/${proxy}`;
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}${path}`;
  }
  return path;
}

async function postAnthropicMessagesBody(body) {
  const useProxy = isAnthropicProxyConfigured();
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
    const msg = json?.error?.message || json?.message || res.statusText || "API error";
    throw new Error(msg);
  }
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
