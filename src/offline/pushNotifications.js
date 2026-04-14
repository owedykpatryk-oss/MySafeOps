// MySafeOps — Push Notifications Manager
// No external libraries needed — uses Web Push API + Notification API

import { loadOrgScoped, saveOrgScoped } from "../utils/orgStorage";
import { supabase } from "../lib/supabase";

const VAPID_PUBLIC_KEY = String(import.meta.env.VITE_VAPID_PUBLIC_KEY || "").trim();
const NOTIF_PREFS_KEY = "mysafeops_notif_prefs";
const DEFAULT_SCHEDULER_INTERVAL_MS = 30 * 60 * 1000;
const BRIEFING_PENDING_MINUTES = 20;
const PERMIT_TYPES_REQUIRING_BRIEFING = new Set([
  "hot_works",
  "confined_space",
  "loto",
  "excavation",
  "lifting_ops",
  "temporary_works",
  "electrical_isolation",
]);

function loadNotificationPrefs() {
  try {
    return JSON.parse(localStorage.getItem(NOTIF_PREFS_KEY) || "{}");
  } catch {
    return {};
  }
}

function isNotificationTypeEnabled(typeKey) {
  const prefs = loadNotificationPrefs();
  return prefs?.[typeKey] !== false;
}

function hasVapidPublicKey() {
  return Boolean(VAPID_PUBLIC_KEY && VAPID_PUBLIC_KEY.length > 24);
}

function getOrgSlug() {
  const v = String(localStorage.getItem("mysafeops_orgId") || "default").trim().toLowerCase();
  return v || "default";
}

async function syncSubscriptionToCloud(subscription) {
  if (!supabase || !subscription) return;
  try {
    await supabase.functions.invoke("push-subscription", {
      body: { action: "upsert", orgSlug: getOrgSlug(), subscription },
    });
  } catch (err) {
    console.warn("[MySafeOps Push] Cloud subscription sync failed:", err);
  }
}

async function removeSubscriptionFromCloud(endpoint) {
  if (!supabase || !endpoint) return;
  try {
    await supabase.functions.invoke("push-subscription", {
      body: { action: "remove", orgSlug: getOrgSlug(), endpoint },
    });
  } catch (err) {
    console.warn("[MySafeOps Push] Cloud unsubscription failed:", err);
  }
}

// ─── Permission & subscription ───────────────────────────────────────────────
export async function requestNotificationPermission() {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  const result = await Notification.requestPermission();
  return result;
}

export async function subscribeToPush() {
  const reg = await navigator.serviceWorker?.ready;
  if (!reg) return null;
  if (!("PushManager" in window)) return null;

  try {
    const existing = await reg.pushManager.getSubscription();
    if (existing) {
      await syncSubscriptionToCloud(existing.toJSON?.() || existing);
      return existing;
    }
    if (!hasVapidPublicKey()) {
      // Local reminders still work without server-side push subscription.
      return null;
    }

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
    await syncSubscriptionToCloud(sub.toJSON?.() || sub);

    return sub;
  } catch (err) {
    console.warn("[MySafeOps Push] Subscription failed:", err);
    return null;
  }
}

export async function unsubscribeFromPush() {
  const reg = await navigator.serviceWorker?.ready;
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    const endpoint = sub.endpoint || "";
    await removeSubscriptionFromCloud(endpoint);
    await sub.unsubscribe();
    return true;
  }
  return false;
}

export async function sendCloudPermitPush(payload = {}) {
  if (!supabase) return { ok: false, skipped: true, reason: "supabase_not_configured" };
  try {
    const body = {
      orgSlug: getOrgSlug(),
      ...payload,
    };
    const { data, error } = await supabase.functions.invoke("send-permit-web-push", { body });
    if (error) throw error;
    if (data?.error) throw new Error(String(data.error));
    return data || { ok: true };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}

export async function getCloudPushHealth() {
  const status = await getNotificationStatus();
  const health = {
    supported: Boolean(status?.supported),
    permission: status?.permission || "unsupported",
    swReady: Boolean(status?.swReady),
    vapidConfigured: Boolean(status?.vapidConfigured),
    subscribed: Boolean(status?.subscribed),
    cloud: { ok: false, reason: "unknown" },
  };
  if (!supabase) {
    health.cloud = { ok: false, reason: "supabase_not_configured" };
    return health;
  }
  try {
    const dry = await sendCloudPermitPush({
      dryRun: true,
      title: "Push health check",
      body: "dry-run",
      tag: `push_health_${Date.now()}`,
      url: "/?tab=settings",
      permit: { id: "HEALTH", type: "general", status: "active", location: "Workspace" },
    });
    if (dry?.ok) {
      health.cloud = {
        ok: true,
        reason: "ready",
        subscriptions: Number(dry?.subscriptions || 0),
      };
    } else {
      health.cloud = {
        ok: false,
        reason: String(dry?.reason || dry?.error || "cloud_dry_run_failed"),
      };
    }
  } catch (err) {
    health.cloud = { ok: false, reason: String(err?.message || err) };
  }
  return health;
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return new Uint8Array([...rawData].map(c => c.charCodeAt(0)));
}

// ─── Local notifications (no server needed) ───────────────────────────────────
// These fire from the browser directly — perfect for cert expiry reminders
// when the app is open. For background notifications when app is closed,
// a push server is required.

export function showLocalNotification(title, options = {}) {
  if (Notification.permission !== "granted") return;

  const defaults = {
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-72.png",
    vibrate: [200, 100, 200],
    tag: options.tag || "mysafeops-local",
  };

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.ready.then(reg => {
      reg.showNotification(title, { ...defaults, ...options });
    });
  } else {
    new Notification(title, { ...defaults, ...options });
  }
}

// ─── Scheduled reminder checks ────────────────────────────────────────────────
// Call this on app load and periodically (e.g. every hour)
// to fire local notifications for upcoming expiries.

const loadJSON = (k, fb) => loadOrgScoped(k, fb);
const saveJSON = (k, v) => saveOrgScoped(k, v);

const NOTIF_SEEN_KEY = "mysafeops_notif_seen";
const THRESHOLDS_DAYS = [30, 14, 7, 1, 0]; // days before expiry to notify
const permitEndIso = (permit) => permit?.endDateTime || permit?.expiryDate || "";

function daysUntil(iso) {
  if (!iso) return null;
  return Math.ceil((new Date(iso) - new Date()) / (1000 * 60 * 60 * 24));
}

function wasRecentlySeen(notifId) {
  const seen = loadJSON(NOTIF_SEEN_KEY, {});
  const ts = seen[notifId];
  if (!ts) return false;
  // Don't re-notify within 12 hours
  return (Date.now() - new Date(ts).getTime()) < 12 * 60 * 60 * 1000;
}

function markSeen(notifId) {
  const seen = loadJSON(NOTIF_SEEN_KEY, {});
  seen[notifId] = new Date().toISOString();
  // Clean old entries (older than 60 days)
  const cutoff = Date.now() - 60 * 24 * 60 * 60 * 1000;
  Object.keys(seen).forEach(k => { if (new Date(seen[k]).getTime() < cutoff) delete seen[k]; });
  saveJSON(NOTIF_SEEN_KEY, seen);
}

export function checkExpiryNotifications() {
  if (Notification.permission !== "granted") return;

  const workers = loadJSON("mysafeops_workers", []);
  const permits = loadJSON("permits_v2", []);
  const equipment = loadJSON("mysafeops_equipment", []);
  const ramsDocs = loadJSON("rams_builder_docs", []);

  // ── Worker certifications ──
  if (isNotificationTypeEnabled("cert_expiry")) workers.forEach(w => {
    (w.certifications || []).forEach(cert => {
      const days = daysUntil(cert.expiryDate);
      if (days === null) return;

      THRESHOLDS_DAYS.forEach(threshold => {
        if (days <= threshold && days >= (threshold === 0 ? -7 : threshold - 1)) {
          const id = `cert_${w.id}_${cert.type}_${threshold}`;
          if (wasRecentlySeen(id)) return;

          const urgency = days <= 0 ? "EXPIRED" : days <= 7 ? "URGENT" : "REMINDER";
          const body = days <= 0
            ? `${cert.type || "Certificate"} for ${w.name} expired ${Math.abs(days)} day${Math.abs(days) !== 1 ? "s" : ""} ago.`
            : `${cert.type || "Certificate"} for ${w.name} expires in ${days} day${days !== 1 ? "s" : ""}.`;

          showLocalNotification(`${urgency}: Certificate expiry`, {
            body,
            tag: id,
            requireInteraction: days <= 1,
            data: { url: "/?tab=workers" },
            actions: [{ action: "view", title: "View worker" }],
          });
          markSeen(id);
        }
      });
    });
  });

  // ── Permits (active only — same-day uses hours for clearer copy) ──
  if (isNotificationTypeEnabled("permit_expiry")) permits.forEach((p) => {
    if (p.status !== "active") return;
    const endIso = permitEndIso(p);
    if (!endIso) return;
    const endMs = new Date(endIso).getTime();
    if (!Number.isFinite(endMs)) return;
    const days = daysUntil(endIso);
    if (days === null) return;

    THRESHOLDS_DAYS.forEach((threshold) => {
      if (days <= threshold && days >= (threshold === 0 ? -1 : threshold - 1)) {
        const id = `permit_${p.id}_${threshold}`;
        if (wasRecentlySeen(id)) return;

        const msLeft = endMs - Date.now();
        const label = p.type ? String(p.type).replace(/_/g, " ") : "Permit";
        let body;
        if (msLeft <= 0) {
          const hoursPast = Math.max(1, Math.ceil(-msLeft / (1000 * 60 * 60)));
          body = `${label} at ${p.location || "site"} expired about ${hoursPast} hour(s) ago.`;
        } else if (days <= 0) {
          const hoursLeft = Math.max(1, Math.ceil(msLeft / (1000 * 60 * 60)));
          body = `${label} at ${p.location || "site"} expires in about ${hoursLeft} hour(s).`;
        } else {
          body = `${label} at ${p.location || "site"} expires in ${days} day(s).`;
        }

        showLocalNotification(msLeft <= 0 ? "Permit expired" : "Permit expiry reminder", {
          body,
          tag: id,
          requireInteraction: days <= 1,
          data: { url: "/?tab=permits" },
        });
        markSeen(id);
      }
    });
  });

  // ── Active permit briefing reminders ──
  if (isNotificationTypeEnabled("permit_briefing")) permits.forEach((p) => {
    const status = String(p?.status || "").toLowerCase();
    const permitType = String(p?.type || "").toLowerCase();
    if (status !== "active" || !PERMIT_TYPES_REQUIRING_BRIEFING.has(permitType)) return;
    if (p?.briefingConfirmedAt) return;
    if (!p?.startDateTime) return;
    const startedMs = new Date(p.startDateTime).getTime();
    if (!Number.isFinite(startedMs)) return;
    const ageMs = Date.now() - startedMs;
    if (ageMs < BRIEFING_PENDING_MINUTES * 60 * 1000) return;

    const minutesLate = Math.floor(ageMs / (60 * 1000));
    const id = `permit_briefing_${p.id}_${Math.floor(minutesLate / 60)}`;
    if (wasRecentlySeen(id)) return;

    showLocalNotification("Permit briefing pending", {
      body: `${(p.type || "Permit").replace(/_/g, " ")} at ${p.location || "site"} has no briefing confirmation (${minutesLate}m since start).`,
      tag: id,
      requireInteraction: minutesLate >= 60,
      data: { url: "/?tab=permits" },
    });
    markSeen(id);
  });

  // ── Active permit missing RAMS link ──
  if (isNotificationTypeEnabled("permit_rams_link")) permits.forEach((p) => {
    const status = String(p?.status || "").toLowerCase();
    if (status !== "active") return;
    if (String(p?.linkedRamsId || "").trim()) return;
    const id = `permit_rams_missing_${p.id}`;
    if (wasRecentlySeen(id)) return;

    showLocalNotification("Active permit missing RAMS", {
      body: `${(p.type || "Permit").replace(/_/g, " ")} at ${p.location || "site"} has no linked RAMS document.`,
      tag: id,
      data: { url: "/?tab=permits" },
    });
    markSeen(id);
  });

  // ── Equipment inspections ──
  if (isNotificationTypeEnabled("equip_inspect")) equipment.forEach(item => {
    const days = daysUntil(item.nextInspection);
    if (days === null) return;

    THRESHOLDS_DAYS.filter(t => t <= 14).forEach(threshold => {
      if (days <= threshold && days >= (threshold === 0 ? -1 : threshold - 1)) {
        const id = `equip_${item.id}_${threshold}`;
        if (wasRecentlySeen(id)) return;

        showLocalNotification("Equipment inspection due", {
          body: `${item.name || "Equipment"} inspection ${days <= 0 ? "overdue" : `due in ${days} day(s)`}.`,
          tag: id,
          data: { url: "/?tab=equipment" },
        });
        markSeen(id);
      }
    });
  });

  // ── RAMS review ──
  if (isNotificationTypeEnabled("rams_review")) ramsDocs.forEach(doc => {
    const days = daysUntil(doc.reviewDate);
    if (days === null) return;

    if (days <= 14 && days >= 0) {
      const id = `rams_review_${doc.id}`;
      if (wasRecentlySeen(id)) return;

      showLocalNotification("RAMS review due", {
        body: `"${doc.title}" is due for review in ${days} day(s).`,
        tag: id,
        data: { url: "/?tab=rams" },
      });
      markSeen(id);
    }
  });
}

// ─── Auto-check scheduler ─────────────────────────────────────────────────────
let checkInterval = null;

export function startNotificationScheduler(intervalMs = 60 * 60 * 1000) {
  checkExpiryNotifications(); // run immediately
  if (checkInterval) clearInterval(checkInterval);
  checkInterval = setInterval(checkExpiryNotifications, intervalMs);
  return () => clearInterval(checkInterval);
}

export function stopNotificationScheduler() {
  if (checkInterval) { clearInterval(checkInterval); checkInterval = null; }
}

export function runNotificationCheckNow() {
  checkExpiryNotifications();
}

export function initNotificationRuntime() {
  if (!("Notification" in window)) return () => {};
  if (Notification.permission !== "granted") return () => {};
  if (isNotificationTypeEnabled("master") === false) return () => {};
  return startNotificationScheduler(DEFAULT_SCHEDULER_INTERVAL_MS);
}

// ─── Settings UI data ─────────────────────────────────────────────────────────
export async function getNotificationStatus() {
  const supported = "Notification" in window;
  const permission = supported ? Notification.permission : "unsupported";
  const reg = await navigator.serviceWorker?.ready;
  const sub = await reg?.pushManager?.getSubscription();
  return {
    supported,
    permission,
    subscribed: !!sub,
    swReady: !!reg,
    vapidConfigured: hasVapidPublicKey(),
  };
}
