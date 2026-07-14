/**
 * Outbound webhook URL validation — blocks SSRF targets (private IPs, metadata, non-HTTPS).
 * Used before saving or dispatching PTW integration webhooks from the browser.
 */

const BLOCKED_HOSTS = new Set([
  "metadata.google.internal",
  "169.254.169.254",
]);

function isPrivateIpv4(host) {
  const parts = host.split(".").map((x) => Number(x));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  if (parts[0] === 10) return true;
  if (parts[0] === 127) return true;
  if (parts[0] === 0) return true;
  if (parts[0] === 169 && parts[1] === 254) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  return false;
}

function isPrivateIpv6(host) {
  const h = host.toLowerCase();
  if (h === "::1") return true;
  if (h.startsWith("fc") || h.startsWith("fd")) return true;
  if (h.startsWith("fe80")) return true;
  return false;
}

/**
 * @returns {{ ok: true, url: string } | { ok: false, error: string }}
 */
export function validateOutboundWebhookUrl(raw, { allowHttpLocalhost = import.meta.env?.DEV } = {}) {
  const input = String(raw || "").trim();
  if (!input) return { ok: false, error: "URL required" };
  if (input.length > 2000) return { ok: false, error: "URL too long" };
  if (/[\0\r\n]/.test(input)) return { ok: false, error: "Invalid URL" };

  let parsed;
  try {
    parsed = new URL(input);
  } catch {
    return { ok: false, error: "Invalid URL format" };
  }

  if (parsed.username || parsed.password) {
    return { ok: false, error: "URL must not include credentials" };
  }

  const protocol = parsed.protocol.toLowerCase();
  const host = parsed.hostname.toLowerCase();

  const isLocalhost = host === "localhost" || host.endsWith(".localhost") || host === "127.0.0.1" || host === "::1";

  if (BLOCKED_HOSTS.has(host)) {
    return { ok: false, error: "URL host is not allowed" };
  }
  if (!isLocalhost && (isPrivateIpv4(host) || isPrivateIpv6(host))) {
    return { ok: false, error: "Private network URLs are not allowed" };
  }

  if (protocol === "https:") {
    // ok
  } else if (protocol === "http:" && allowHttpLocalhost && isLocalhost) {
    // dev-only
  } else {
    return { ok: false, error: "Only HTTPS webhook URLs are allowed" };
  }

  return { ok: true, url: parsed.toString() };
}

export function sanitizeWebhookConfigUrls(config = {}) {
  const next = { ...config };
  const fields = ["url", "slackUrl", "teamsUrl"];
  for (const field of fields) {
    const raw = String(next[field] || "").trim();
    if (!raw) {
      next[field] = "";
      continue;
    }
    const check = validateOutboundWebhookUrl(raw);
    next[field] = check.ok ? check.url : "";
  }
  return next;
}
