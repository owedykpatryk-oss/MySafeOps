/**
 * Browser-side Anthropic API (dev / local only — key is visible in the client).
 * Set VITE_ANTHROPIC_API_KEY and optionally VITE_ANTHROPIC_MODEL in .env
 */

export function getAnthropicKey() {
  return import.meta.env.VITE_ANTHROPIC_API_KEY || "";
}

export function getAnthropicModel() {
  return import.meta.env.VITE_ANTHROPIC_MODEL || "claude-sonnet-4-20250514";
}

export async function anthropicMessages({ system, messages, maxTokens = 4096 }) {
  const apiKey = getAnthropicKey();
  if (!apiKey) throw new Error("Missing VITE_ANTHROPIC_API_KEY in .env");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: getAnthropicModel(),
      max_tokens: maxTokens,
      system: system || undefined,
      messages,
    }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error?.message || json?.message || res.statusText || "API error";
    throw new Error(msg);
  }
  const block = json?.content?.find((c) => c.type === "text");
  return block?.text || "";
}
