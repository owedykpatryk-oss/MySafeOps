/**
 * Client-side ops monitor — captures console/runtime errors, stores a local ring buffer,
 * forwards to Sentry when configured, and applies safe auto-heal for known patterns.
 */
import { orgScopedKey, getOrgId } from "./orgStorage";
import { captureSentryException, addSentryBreadcrumb } from "./sentryClient.js";
import { isChunkLoadError, reloadOnceForStaleChunk } from "./chunkLoadError.js";

const OPS_LOG_KEY = "mysafeops_ops_log";
const MAX_OPS = 120;
const OPS_TOAST_EVENT = "mysafeops-ops-toast";

let booted = false;
let originalConsoleError = null;

function storageKey() {
  return orgScopedKey(OPS_LOG_KEY);
}

function readRawOpsLog() {
  try {
    const list = JSON.parse(localStorage.getItem(storageKey()) || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeRawOpsLog(list) {
  try {
    localStorage.setItem(storageKey(), JSON.stringify(list.slice(0, MAX_OPS)));
  } catch {
    /* quota — drop oldest half */
    try {
      localStorage.setItem(storageKey(), JSON.stringify(list.slice(0, Math.floor(MAX_OPS / 2))));
    } catch {
      /* ignore */
    }
  }
}

/** @param {Record<string, unknown>} entry */
export function logOpsEvent(entry) {
  const row = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
    orgId: getOrgId(),
    level: entry.level || "info",
    source: entry.source || "app",
    message: String(entry.message || "").slice(0, 2000),
    stack: entry.stack ? String(entry.stack).slice(0, 4000) : undefined,
    url: entry.url ? String(entry.url).slice(0, 512) : undefined,
    healAction: entry.healAction || undefined,
    meta: entry.meta && typeof entry.meta === "object" ? entry.meta : undefined,
  };
  writeRawOpsLog([row, ...readRawOpsLog()]);
  if (row.level === "error" || row.level === "critical") {
    addSentryBreadcrumb({
      category: "ops",
      level: row.level === "critical" ? "error" : "warning",
      message: row.message.slice(0, 200),
      data: { source: row.source, healAction: row.healAction },
    });
  }
  if (row.level === "critical") {
    captureSentryException(new Error(row.message), {
      tags: { ops_source: row.source },
      extra: { stack: row.stack, healAction: row.healAction, meta: row.meta },
    });
  }
  return row;
}

export function readOpsLog() {
  return readRawOpsLog();
}

export function clearOpsLog() {
  localStorage.removeItem(storageKey());
}

export function exportOpsLogJson() {
  return JSON.stringify(readOpsLog(), null, 2);
}

function emitOpsToast(detail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPS_TOAST_EVENT, { detail }));
}

/** @returns {{ healAction?: string, userMessage?: string, level?: string }} */
export function classifyAndHeal(message, meta = {}) {
  const msg = String(message || "");
  const lower = msg.toLowerCase();
  const errLike = meta.error instanceof Error ? meta.error : { message: msg };

  if (isChunkLoadError(errLike) || isChunkLoadError(msg)) {
    const reloaded = reloadOnceForStaleChunk();
    if (reloaded) {
      return {
        level: "critical",
        healAction: "reload_once",
        userMessage: "App update detected — reloading once to load the latest version.",
      };
    }
    return {
      level: "critical",
      healAction: "reload_blocked",
      userMessage: "Could not load part of the app. Try a hard refresh (Ctrl+F5) or clear site cache.",
    };
  }

  if (/content security policy/i.test(msg) && /connect-src/i.test(msg)) {
    return {
      level: "error",
      healAction: "csp_connect",
      userMessage: "A network request was blocked by security policy. If this persists after refresh, contact support with the diagnostics export.",
    };
  }

  if (/networkerror when attempting to fetch/i.test(msg) || meta.offline === true) {
    return {
      level: "warn",
      healAction: "offline_hint",
      userMessage: "Network issue — check your connection. Offline changes queue until sync is back.",
    };
  }

  if (/referenceerror.*before initialization/i.test(msg)) {
    return {
      level: "critical",
      userMessage: "A screen failed to load (app bug). Details were saved — open Audit log → Diagnostics to export.",
    };
  }

  if (/failed to fetch/i.test(lower) && /\/api\//i.test(msg)) {
    return {
      level: "error",
      healAction: "api_fetch_failed",
      userMessage: "Server request failed. Retry in a moment or check Settings → Backup sync status.",
    };
  }

  return { level: meta.uncaught ? "critical" : "error" };
}

function handleRuntimeIssue(message, { source, stack, url, uncaught = false, meta = {} } = {}) {
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  const plan = classifyAndHeal(message, { ...meta, offline });
  const row = logOpsEvent({
    level: plan.level || (uncaught ? "critical" : "error"),
    source,
    message,
    stack,
    url,
    healAction: plan.healAction,
    meta,
  });

  if (plan.userMessage && (plan.level === "critical" || uncaught)) {
    emitOpsToast({
      type: plan.level === "critical" ? "error" : "warn",
      title: "Something went wrong",
      message: plan.userMessage,
      durationMs: 6000,
    });
  }

  if (plan.healAction === "reload_once") {
    emitOpsToast({
      type: "info",
      title: "Updating app",
      message: plan.userMessage || "Reloading…",
      durationMs: 2500,
    });
  }

  return row;
}

function onWindowError(event) {
  const msg = event?.message || "Unknown script error";
  const stack = event?.error?.stack;
  handleRuntimeIssue(msg, {
    source: "window.onerror",
    stack,
    url: event?.filename || window.location?.href,
    uncaught: true,
    meta: { lineno: event?.lineno, colno: event?.colno },
  });
}

function onUnhandledRejection(event) {
  const reason = event?.reason;
  const msg =
    reason instanceof Error
      ? reason.message
      : typeof reason === "string"
        ? reason
        : "Unhandled promise rejection";
  const stack = reason instanceof Error ? reason.stack : undefined;
  handleRuntimeIssue(msg, {
    source: "unhandledrejection",
    stack,
    url: window.location?.href,
    uncaught: true,
  });
}

function patchConsoleError() {
  if (originalConsoleError || typeof console === "undefined") return;
  originalConsoleError = console.error.bind(console);
  console.error = (...args) => {
    originalConsoleError(...args);
    try {
      const message = args
        .map((a) => {
          if (a instanceof Error) return a.message;
          if (typeof a === "object") {
            try {
              return JSON.stringify(a);
            } catch {
              return String(a);
            }
          }
          return String(a);
        })
        .join(" ")
        .slice(0, 2000);
      if (!message || /^\[RouteErrorBoundary\]/i.test(message)) return;
      handleRuntimeIssue(message, { source: "console.error", uncaught: false });
    } catch {
      /* never break console */
    }
  };
}

export function initClientOpsMonitor() {
  if (booted || typeof window === "undefined") return;
  booted = true;

  window.addEventListener("error", onWindowError);
  window.addEventListener("unhandledrejection", onUnhandledRejection);
  patchConsoleError();

  logOpsEvent({
    level: "info",
    source: "ops-monitor",
    message: `Ops monitor started (${import.meta.env.MODE})`,
  });
}

export const OPS_TOAST_EVENT_NAME = OPS_TOAST_EVENT;
