import { loadOrgScoped, saveOrgScoped } from "./orgStorage";
import {
  detectIncomingWebhookKind,
  pickWebhookPayload,
  postIncomingWebhook,
} from "./permitIntegrationNotify";
import { sanitizeWebhookConfigUrls, validateOutboundWebhookUrl } from "./webhookUrlValidation";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

export const PERMIT_WEBHOOK_CONFIG_KEY = "permit_webhook_config_v1";

const DEFAULT_EVENTS = ["issued", "status_changed", "deleted"];

function normalizeEvents(raw) {
  if (!Array.isArray(raw)) return [...DEFAULT_EVENTS];
  const list = raw.map((x) => String(x || "").trim().toLowerCase()).filter(Boolean);
  return list.length ? list.slice(0, 12) : [...DEFAULT_EVENTS];
}

export function loadPermitWebhookConfig() {
  const raw = loadOrgScoped(PERMIT_WEBHOOK_CONFIG_KEY, null);
  if (!raw || typeof raw !== "object") {
    return {
      enabled: false,
      url: "",
      slackEnabled: false,
      slackUrl: "",
      teamsEnabled: false,
      teamsUrl: "",
      events: [...DEFAULT_EVENTS],
    };
  }
  return {
    enabled: Boolean(raw.enabled),
    url: String(raw.url || "").trim(),
    slackEnabled: Boolean(raw.slackEnabled),
    slackUrl: String(raw.slackUrl || "").trim(),
    teamsEnabled: Boolean(raw.teamsEnabled),
    teamsUrl: String(raw.teamsUrl || "").trim(),
    events: normalizeEvents(raw.events),
  };
}

export function savePermitWebhookConfig(config) {
  const sanitized = sanitizeWebhookConfigUrls(config || {});
  saveOrgScoped(PERMIT_WEBHOOK_CONFIG_KEY, {
    enabled: Boolean(config?.enabled),
    url: sanitized.url || "",
    slackEnabled: Boolean(config?.slackEnabled),
    slackUrl: sanitized.slackUrl || "",
    teamsEnabled: Boolean(config?.teamsEnabled),
    teamsUrl: sanitized.teamsUrl || "",
    events: normalizeEvents(config?.events),
    updatedAt: new Date().toISOString(),
  });
}

function shouldDispatchEvent(config, action) {
  if (!config.events.length) return true;
  return config.events.includes(action);
}

function integrationTargets(config) {
  const targets = [];
  if (config.enabled && config.url) {
    const check = validateOutboundWebhookUrl(config.url);
    if (check.ok) targets.push({ channel: "webhook", url: check.url, kind: detectIncomingWebhookKind(check.url) });
  }
  if (config.slackEnabled && config.slackUrl) {
    const check = validateOutboundWebhookUrl(config.slackUrl);
    if (check.ok) targets.push({ channel: "slack", url: check.url, kind: "slack" });
  }
  if (config.teamsEnabled && config.teamsUrl) {
    const check = validateOutboundWebhookUrl(config.teamsUrl);
    if (check.ok) targets.push({ channel: "teams", url: check.url, kind: "teams" });
  }
  return targets;
}

function slimPermit(permit) {
  if (!permit || typeof permit !== "object") return {};
  return {
    id: permit.id || "",
    type: permit.type || "",
    status: permit.status || "",
    location: permit.location || "",
    issuedTo: permit.issuedTo || "",
  };
}

async function dispatchViaEdge(event, permit, detail, targets) {
  if (!isSupabaseConfigured() || !supabase) return null;
  try {
    const { data: sess } = await supabase.auth.getSession();
    if (!sess?.session?.access_token) return null;
    const { data, error } = await supabase.functions.invoke("dispatch-permit-webhook", {
      body: {
        event,
        permit: slimPermit(permit),
        detail: detail && typeof detail === "object" ? detail : {},
        targets,
      },
    });
    if (error) return { ok: false, error: error.message || "Edge dispatch failed", via: "edge" };
    return { ...(data || {}), via: "edge" };
  } catch (e) {
    return { ok: false, error: String(e?.message || e), via: "edge" };
  }
}

async function dispatchViaBrowser(event, permit, detail, targets) {
  const results = await Promise.all(
    targets.map(({ channel, url, kind }) =>
      postIncomingWebhook(url, pickWebhookPayload(event, permit, detail, kind), `ptw-${channel}`).then((res) => ({
        channel,
        ...res,
      }))
    )
  );
  const ok = results.some((r) => r.ok);
  return { ok, results, via: "browser" };
}

/** POST permit event to configured webhooks via Edge (prod) or browser fallback (dev only). */
export function dispatchPermitWebhook(event, permit, detail = {}) {
  const config = loadPermitWebhookConfig();
  const action = String(event || "").toLowerCase();
  if (!shouldDispatchEvent(config, action)) {
    return Promise.resolve({ skipped: true, reason: "event_not_subscribed" });
  }

  const targets = integrationTargets(config);
  if (!targets.length) return Promise.resolve({ skipped: true });

  return (async () => {
    const edge = await dispatchViaEdge(action, permit, detail, targets);
    if (edge && edge.via === "edge" && !edge.error) return edge;
    if (edge?.ok) return edge;

    // Production: do not fan-out from the browser (SSRF / CORS / secret leakage surface).
    if (import.meta.env.PROD) {
      return {
        ok: false,
        error: edge?.error || "Sign in to dispatch PTW webhooks from the server.",
        via: "edge",
        results: edge?.results,
      };
    }

    return dispatchViaBrowser(action, permit, detail, targets);
  })();
}

export async function testPermitWebhook(url, kind = "generic") {
  const check = validateOutboundWebhookUrl(url);
  if (!check.ok) return { ok: false, error: check.error };
  const target = check.url;
  const resolvedKind = kind === "auto" ? detectIncomingWebhookKind(target) : kind;
  const permit = { id: "TEST", type: "general", location: "Test area", status: "draft" };
  const targets = [{ channel: "test", url: target, kind: resolvedKind }];

  const edge = await dispatchViaEdge("test", permit, {}, targets);
  if (edge && !edge.error && edge.ok !== false) return { ...edge, ok: Boolean(edge.ok ?? true) };
  if (import.meta.env.PROD) {
    return { ok: false, error: edge?.error || "Sign in to test webhooks from the server." };
  }

  const payload =
    resolvedKind === "slack"
      ? pickWebhookPayload("test", permit, {}, "slack")
      : resolvedKind === "teams"
        ? pickWebhookPayload("test", permit, {}, "teams")
        : { event: "test", at: new Date().toISOString(), message: "MySafeOps PTW webhook test" };

  return postIncomingWebhook(target, payload, "ptw-webhook-test");
}

export { integrationTargets };
