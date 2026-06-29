import { safeHttpUrl } from "./safeUrl.js";

/** Escape text for HTML body content. */
export function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escape for double-quoted HTML attributes. */
export function escapeAttr(s) {
  return escapeHtml(s);
}

/** Allow only #RGB / #RRGGBB for inline CSS colours (org branding). */
export function safeCssColor(raw, fallback = "#0d9488") {
  const t = String(raw ?? "").trim();
  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(t)) return t;
  return fallback;
}

/** http(s) URLs or safe data:image (png/jpeg/gif/webp) for print previews. */
export function safeImageSrc(raw) {
  const http = safeHttpUrl(raw);
  if (http) return http;
  const t = String(raw ?? "").trim().replace(/\s+/g, "");
  if (/^data:image\/(?:png|jpe?g|gif|webp);base64,[a-z0-9+/=]+$/i.test(t)) {
    return t;
  }
  return null;
}

/**
 * Query-string tokens from share links — block injection / log-spam payloads.
 * Matches portal_*, ptw_*, ack_*, r_* style ids.
 */
export function safeOpaqueToken(raw, { maxLen = 128 } = {}) {
  const t = String(raw ?? "").trim();
  if (!t || t.length > maxLen) return null;
  if (!/^[a-zA-Z0-9_-]+$/.test(t)) return null;
  return t;
}

/** Strip active content from print-preview HTML before iframe srcDoc. */
export function sanitizePrintPreviewHtml(html) {
  let out = String(html || "");
  for (let i = 0; i < 4; i += 1) {
    const prev = out;
    out = stripPrintPreviewActiveContent(out);
    if (out === prev) break;
  }
  return out;
}

function stripPrintPreviewActiveContent(out) {
  out = out.replace(/<script\b[\s\S]*?<\/script>/gi, "");
  out = out.replace(/<script\b[^>]*\/>/gi, "");
  out = out.replace(/<script\b[^>]*>/gi, "");
  out = out.replace(/<\/script>/gi, "");
  out = out.replace(/<iframe\b[\s\S]*?<\/iframe>/gi, "");
  out = out.replace(/<object\b[\s\S]*?<\/object>/gi, "");
  out = out.replace(/<embed\b[^>]*\/?>/gi, "");
  out = out.replace(/<base\b[^>]*>/gi, "");
  out = out.replace(/<link\b[^>]*\brel\s*=\s*["']?(?:import|preload|prefetch)["']?[^>]*>/gi, "");
  out = out.replace(/<meta\b[^>]*http-equiv\s*=\s*["']?refresh["']?[^>]*>/gi, "");
  out = out.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  out = out.replace(
    /\s(href|src|xlink:href|formaction|action|poster|data)\s*=\s*(["']?)\s*(javascript|vbscript|data\s*:\s*text\/html)[^>\s]*/gi,
    ""
  );
  out = out.replace(/url\s*\(\s*["']?\s*javascript:/gi, "url(");
  out = out.replace(/expression\s*\(/gi, "");
  return out;
}

/** Open a blank print window without giving it `window.opener` access. */
export function openPrintWindow() {
  return window.open("", "_blank", "noopener,noreferrer");
}
