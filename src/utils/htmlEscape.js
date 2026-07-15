import { safeHttpUrl } from "./safeUrl.js";

let domPurifyPromise = null;

async function loadDomPurify() {
  if (domPurifyPromise) return domPurifyPromise;
  domPurifyPromise = import("dompurify")
    .then((m) => m.default)
    .catch(() => null);
  return domPurifyPromise;
}

/** Keep full document + <style> — otherwise survey/RAMS print CSS is dropped and PDF/print looks empty. */
const PRINT_PURIFY_CONFIG = {
  USE_PROFILES: { html: true },
  WHOLE_DOCUMENT: true,
  ADD_TAGS: ["style"],
  ADD_ATTR: ["target", "class", "id", "style", "width", "height", "viewBox", "xmlns", "fill", "stroke", "d", "cx", "cy", "r", "x", "y", "transform", "preserveAspectRatio"],
  FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "base", "link", "meta", "foreignObject"],
  FORBID_ATTR: ["onerror", "onclick", "onload", "onmouseover", "onfocus", "onblur", "srcdoc"],
};

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
  const raw = String(html || "");
  if (typeof window !== "undefined") {
    try {
      // Sync path when DOMPurify already loaded (browser print flows).
      const purify = window.__mysafeopsPurify;
      if (purify?.sanitize) {
        return purify.sanitize(raw, PRINT_PURIFY_CONFIG);
      }
    } catch {
      /* fallback below */
    }
  }
  return sanitizePrintPreviewHtmlRegex(raw);
}

/** Async sanitizer — prefers DOMPurify when available (browser). */
export async function sanitizePrintPreviewHtmlAsync(html) {
  const raw = String(html || "");
  if (typeof window !== "undefined") {
    const purify = await loadDomPurify();
    if (purify?.sanitize) {
      window.__mysafeopsPurify = purify;
      return purify.sanitize(raw, PRINT_PURIFY_CONFIG);
    }
  }
  return sanitizePrintPreviewHtmlRegex(raw);
}

function sanitizePrintPreviewHtmlRegex(html) {
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
  out = out.replace(/<noscript\b[\s\S]*?<\/noscript>/gi, "");
  out = out.replace(/<iframe\b[\s\S]*?<\/iframe>/gi, "");
  out = out.replace(/<object\b[\s\S]*?<\/object>/gi, "");
  out = out.replace(/<embed\b[^>]*\/?>/gi, "");
  out = out.replace(/<base\b[^>]*>/gi, "");
  out = out.replace(/<link\b[^>]*>/gi, "");
  out = out.replace(/<meta\b[^>]*http-equiv\s*=\s*["']?refresh["']?[^>]*>/gi, "");
  out = out.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  out = out.replace(
    /\s(href|src|xlink:href|formaction|action|poster|data)\s*=\s*(["']?)\s*(javascript|vbscript|data\s*:\s*text\/html)[^>\s]*/gi,
    ""
  );
  out = out.replace(/url\s*\(\s*["']?\s*javascript:/gi, "url(");
  out = out.replace(/expression\s*\(/gi, "");
  // SVG active content
  out = out.replace(/<foreignObject\b[\s\S]*?<\/foreignObject>/gi, "");
  out = out.replace(/<(?:script|handler)\b[\s\S]*?<\/(?:script|handler)>/gi, "");
  return out;
}

const PRINT_PREVIEW_CSP =
  "default-src 'none'; style-src 'unsafe-inline'; img-src data: https: http:; font-src data: https:; script-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none';";

/** Wrap sanitized HTML for iframe srcDoc — injects CSP so scripts never run in sandboxed preview. */
export function buildPrintPreviewSrcDoc(html) {
  const safe = sanitizePrintPreviewHtml(html);
  const cspMeta = `<meta http-equiv="Content-Security-Policy" content="${PRINT_PREVIEW_CSP}"/>`;
  if (/<html[\s>]/i.test(safe)) {
    if (/<head[\s>]/i.test(safe)) {
      return safe.replace(/<head([^>]*)>/i, `<head$1>${cspMeta}`);
    }
    return safe.replace(/<html([^>]*)>/i, `<html$1><head>${cspMeta}</head>`);
  }
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>${cspMeta}</head><body>${safe}</body></html>`;
}

/** Open a blank print window without giving it `window.opener` access. */
export function openPrintWindow() {
  const openFn = globalThis.window?.open?.bind(globalThis.window) || globalThis.open?.bind(globalThis);
  if (typeof openFn !== "function") return null;
  return openFn("", "_blank", "noopener,noreferrer");
}

const PRINT_POPUP_BLOCKED_MSG =
  "Pop-up blocked — allow pop-ups for MySafeOps to print / save PDF.";

/**
 * Open a print window or alert when the browser blocks it.
 * @param {{ message?: string; silent?: boolean }} [opts]
 * @returns {Window | null}
 */
export function openPrintWindowOrWarn(opts = {}) {
  const win = openPrintWindow();
  if (!win && !opts.silent) {
    const alertFn = globalThis.window?.alert || globalThis.alert;
    if (typeof alertFn === "function") alertFn(opts.message || PRINT_POPUP_BLOCKED_MSG);
  }
  return win;
}

/** Write sanitized HTML into a print window (CSP + DOMPurify when loaded). */
export async function writePrintWindowDocument(win, html) {
  if (!win?.document) return;
  const sanitized = await sanitizePrintPreviewHtmlAsync(html);
  const cspMeta = `<meta http-equiv="Content-Security-Policy" content="${PRINT_PREVIEW_CSP}"/>`;
  let safe = sanitized;
  if (/<html[\s>]/i.test(safe)) {
    if (/<head[\s>]/i.test(safe)) {
      safe = safe.replace(/<head([^>]*)>/i, `<head$1>${cspMeta}`);
    } else {
      safe = safe.replace(/<html([^>]*)>/i, `<html$1><head>${cspMeta}</head>`);
    }
  } else {
    safe = `<!DOCTYPE html><html><head><meta charset="utf-8"/>${cspMeta}</head><body>${safe}</body></html>`;
  }
  win.document.open();
  win.document.write(safe);
  win.document.close();
}
