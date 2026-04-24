import { useEffect, useMemo, useState } from "react";
import { useApp } from "../context/AppContext";
import { useSupabaseAuth } from "../context/SupabaseAuthContext";
import { useToast } from "../context/ToastContext";
import { isSuperAdminEmail } from "../utils/superAdmin";
import { getSupabaseUrl, isSupabaseConfigured, supabase } from "../lib/supabase";
import { getSupportEmail } from "../config/supportContact";
import {
  BILLING_COMPARISON_PLAN_IDS,
  BILLING_PLANS,
  STRIPE_SUBSCRIBABLE_PLAN_IDS,
  formatBytes,
  formatLimitCount,
  formatStorageLimit,
  getEffectivePlan,
  getPlanByComparisonId,
} from "../lib/billingPlans";
import { trackBillingError, trackBillingEvent } from "../lib/billingTelemetry";
import { refreshOrgFromSupabase } from "../utils/orgMembership";
import { ms } from "../utils/moduleStyles";
import InlineAlert from "./InlineAlert";
import PageHero from "./PageHero";

const ss = ms;
const SUPPORT_EMAIL = getSupportEmail();
const NO_MEMBERSHIP_MSG = "No organisation membership";
const STRIPE_FN_KEYS = ["stripe-checkout", "stripe-portal", "stripe-webhook"];
const EDGE_FN_TIMEOUT_MS = 10000;

function withTimeout(promise, timeoutMs, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)}s`)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function isTransientInvokeFailure(msg) {
  const lower = String(msg || "").toLowerCase();
  return (
    lower.includes("failed to send a request to the edge function") ||
    lower.includes("network") ||
    lower.includes("fetch") ||
    lower.includes("timed out")
  );
}

function readArrayCount(storageKey) {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || "[]");
    return Array.isArray(value) ? value.length : 0;
  } catch {
    return 0;
  }
}

function estimateOrgStorageBytes(orgId) {
  const suffix = `_${orgId}`;
  let total = 0;
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key || !key.endsWith(suffix)) continue;
    const raw = localStorage.getItem(key) || "";
    total += key.length + raw.length;
  }
  return total * 2;
}

function formatDateTime(value) {
  if (!value) return "n/a";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "n/a";
  return date.toLocaleString();
}

export default function BillingLimits({ checkoutReturn = null }) {
  const { orgId, trialStatus, billing, role } = useApp();
  const { user } = useSupabaseAuth();
  const { pushToast } = useToast();
  const isPlatformOwner = isSuperAdminEmail(user?.email);
  const plan = getEffectivePlan(trialStatus, billing, { isPlatformOwner });
  const [checkoutLoading, setCheckoutLoading] = useState(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [actionError, setActionError] = useState(null);
  /** unknown | checking | ready | missing | misconfigured | probe_failed */
  const [stripeFnStatus, setStripeFnStatus] = useState("unknown");
  const [stripeFnHealth, setStripeFnHealth] = useState({});
  const [stripeFnDiagnostics, setStripeFnDiagnostics] = useState({});
  const [lastHealthCheckAt, setLastHealthCheckAt] = useState(null);
  const [lastActionRequestId, setLastActionRequestId] = useState(null);

  const isAdmin = role === "admin";
  const cloudOk = isSupabaseConfigured() && supabase;
  const portalReady = stripeFnHealth["stripe-portal"] === "ready";
  const checkoutBlocked = stripeFnStatus === "missing" || stripeFnStatus === "misconfigured";
  const stripeCheckoutEnabled = cloudOk && isAdmin && !checkoutBlocked;
  const stripePortalEnabled = cloudOk && isAdmin && portalReady;

  useEffect(() => {
    if (checkoutReturn !== "success" || !supabase) return;
    let cancelled = false;
    (async () => {
      try {
        await refreshOrgFromSupabase(supabase);
        if (!cancelled) {
          pushToast({ type: "success", message: "Billing synced from Stripe." });
        }
      } catch (e) {
        if (!cancelled) {
          pushToast({ type: "error", message: e?.message || "Could not refresh billing." });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [checkoutReturn, supabase, pushToast]);

  useEffect(() => {
    if (checkoutReturn === "canceled") {
      pushToast({ type: "info", message: "Checkout canceled. You can subscribe anytime from this page." });
    }
  }, [checkoutReturn, pushToast]);

  useEffect(() => {
    if (!cloudOk || !isAdmin) {
      setStripeFnStatus("unknown");
      setStripeFnHealth({});
      setStripeFnDiagnostics({});
      setLastHealthCheckAt(null);
      return;
    }
    let cancelled = false;
    const run = async () => {
      setStripeFnStatus("checking");
      setStripeFnHealth(Object.fromEntries(STRIPE_FN_KEYS.map((k) => [k, "checking"])));
      try {
        const base = String(getSupabaseUrl() || "").replace(/\/$/, "");
        if (!base) throw new Error("Missing Supabase URL");
        const results = await Promise.all(
          STRIPE_FN_KEYS.map(async (fn) => {
            try {
              // Use a simple GET existence check to avoid browser/CORS false negatives from custom-header OPTIONS probes.
              const controller = new AbortController();
              const timer = setTimeout(() => controller.abort(), EDGE_FN_TIMEOUT_MS);
              const res = await fetch(`${base}/functions/v1/${fn}`, { method: "GET", signal: controller.signal }).finally(
                () => clearTimeout(timer)
              );
              if (res.status === 404) return [fn, "missing"];
              if (res.status === 503) {
                const body = await res.json().catch(() => null);
                return [fn, "misconfigured", body];
              }
              const data = await res.json().catch(() => null);
              if (data?.configured && typeof data.configured === "object") {
                const configuredValues = Object.values(data.configured);
                if (configuredValues.length && configuredValues.some((v) => !v)) {
                  return [fn, "misconfigured", data];
                }
              }
              if (data?.valid && typeof data.valid === "object") {
                const validValues = Object.values(data.valid);
                if (validValues.length && validValues.some((v) => !v)) {
                  return [fn, "misconfigured", data];
                }
              }
              return [fn, "ready", data];
            } catch {
              return [fn, "probe_failed"];
            }
          })
        );
        if (cancelled) return;
        const health = Object.fromEntries(results.map(([fn, status]) => [fn, status]));
        const diagnostics = Object.fromEntries(results.map(([fn, _status, diag]) => [fn, diag || null]));
        setStripeFnHealth(health);
        setStripeFnDiagnostics(diagnostics);
        setLastHealthCheckAt(new Date().toISOString());
        const checkout = health["stripe-checkout"];
        if (checkout === "missing") setStripeFnStatus("missing");
        else if (checkout === "misconfigured") setStripeFnStatus("misconfigured");
        else if (checkout === "ready") setStripeFnStatus("ready");
        else setStripeFnStatus("probe_failed");
        trackBillingEvent("billing_health_checked", { checkoutStatus: checkout, health });
      } catch {
        if (!cancelled) {
          setStripeFnStatus("probe_failed");
          setStripeFnHealth(Object.fromEntries(STRIPE_FN_KEYS.map((k) => [k, "probe_failed"])));
          setStripeFnDiagnostics({});
          setLastHealthCheckAt(new Date().toISOString());
        }
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [cloudOk, isAdmin]);

  const usage = useMemo(() => {
    const workers = readArrayCount(`mysafeops_workers_${orgId}`);
    const projects = readArrayCount(`mysafeops_projects_${orgId}`);
    const cloudBytesEstimate = estimateOrgStorageBytes(orgId);
    return { workers, projects, cloudBytesEstimate };
  }, [orgId]);

  const limits = plan.limits;
  const workersPct = Math.min(100, Math.round((usage.workers / limits.workers) * 100));
  const projectsPct = Math.min(100, Math.round((usage.projects / limits.projects) * 100));
  const storagePct = Math.min(100, Math.round((usage.cloudBytesEstimate / limits.cloudBytes) * 100));

  const invokeStripeFunctionWithRecovery = async (fnName, body = {}) => {
    const invokeOnce = () =>
      withTimeout(
        supabase.functions.invoke(fnName, { body }),
        EDGE_FN_TIMEOUT_MS,
        `${fnName} request`
      );

    const first = await invokeOnce();
    const firstMsg = first?.error?.message || first?.data?.error || "";
    if (isTransientInvokeFailure(firstMsg)) {
      const second = await invokeOnce();
      const secondMsg = second?.error?.message || second?.data?.error || "";
      if (!String(secondMsg).toLowerCase().includes("no organisation membership")) {
        return second;
      }
      await refreshOrgFromSupabase(supabase);
      return invokeOnce();
    }
    if (!String(firstMsg).toLowerCase().includes("no organisation membership")) {
      return first;
    }
    await refreshOrgFromSupabase(supabase);
    return invokeOnce();
  };

  const startCheckout = async (planId) => {
    setActionError(null);
    if (!supabase) {
      setActionError("Sign in with cloud account to manage subscriptions.");
      return;
    }
    if (stripeFnStatus === "missing") {
      const msg =
        "Stripe Edge Functions are not deployed on this Supabase project (missing stripe-checkout).";
      setActionError(msg);
      pushToast({ type: "error", message: msg });
      return;
    }
    if (stripeFnStatus === "misconfigured") {
      const msg =
        "stripe-checkout is deployed but not configured. Add STRIPE_SECRET_KEY, STRIPE_PRICE_* and SITE_URL in Supabase Edge Function secrets.";
      setActionError(msg);
      pushToast({ type: "error", message: msg });
      return;
    }
    setCheckoutLoading(planId);
    try {
      const { data, error } = await invokeStripeFunctionWithRecovery("stripe-checkout", { planId });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.requestId) setLastActionRequestId(String(data.requestId));
      if (data?.url) {
        trackBillingEvent("stripe_checkout_redirect", { planId });
        window.location.href = data.url;
        return;
      }
      throw new Error("No checkout URL returned");
    } catch (e) {
      const raw = e?.message || "Could not start checkout";
      const lower = String(raw).toLowerCase();
      const msg = lower.includes("no organisation membership")
        ? `${NO_MEMBERSHIP_MSG}. Please sign out and sign in again.`
        : (lower.includes("failed to send a request to the edge function") ||
            lower.includes("timed out") ||
            lower.includes("network"))
          ? "Could not reach Supabase Edge Function. Deploy stripe-checkout/stripe-portal on this project and verify network access."
          : raw;
      setActionError(msg);
      pushToast({ type: "error", message: msg });
      trackBillingError("stripe_checkout_failed", e, { planId });
    } finally {
      setCheckoutLoading(null);
    }
  };

  const openPortal = async () => {
    setActionError(null);
    if (!supabase) {
      setActionError("Sign in with cloud account to manage subscriptions.");
      return;
    }
    const portalState = stripeFnHealth["stripe-portal"] || "unknown";
    if (portalState === "missing") {
      const msg =
        "Stripe Edge Functions are not deployed on this Supabase project (missing stripe-portal).";
      setActionError(msg);
      pushToast({ type: "error", message: msg });
      return;
    }
    if (portalState === "misconfigured") {
      const msg =
        "stripe-portal is deployed but not configured. Add STRIPE_SECRET_KEY and SITE_URL in Supabase Edge Function secrets.";
      setActionError(msg);
      pushToast({ type: "error", message: msg });
      return;
    }
    setPortalLoading(true);
    try {
      const { data, error } = await invokeStripeFunctionWithRecovery("stripe-portal", {});
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.requestId) setLastActionRequestId(String(data.requestId));
      if (data?.url) {
        trackBillingEvent("stripe_portal_opened", {});
        window.location.href = data.url;
        return;
      }
      throw new Error("No portal URL returned");
    } catch (e) {
      const raw = e?.message || "Could not open billing portal";
      const lower = String(raw).toLowerCase();
      const msg = lower.includes("no organisation membership")
        ? `${NO_MEMBERSHIP_MSG}. Please sign out and sign in again.`
        : (lower.includes("failed to send a request to the edge function") ||
            lower.includes("timed out") ||
            lower.includes("network"))
          ? "Could not reach Supabase Edge Function. Deploy stripe-checkout/stripe-portal on this project and verify network access."
          : raw;
      setActionError(msg);
      pushToast({ type: "error", message: msg });
      trackBillingError("stripe_portal_failed", e, {});
    } finally {
      setPortalLoading(false);
    }
  };

  const paidActive =
    (billing?.subscriptionStatus === "active" || billing?.subscriptionStatus === "trialing") &&
    billing?.paidPlanId;

  const healthChip = (status) => {
    if (status === "ready") return { label: "reachable", color: "#0f766e", bg: "#ccfbf1", border: "#99f6e4" };
    if (status === "missing") return { label: "missing", color: "#991b1b", bg: "#fee2e2", border: "#fecaca" };
    if (status === "misconfigured") return { label: "not configured", color: "#9a3412", bg: "#ffedd5", border: "#fed7aa" };
    if (status === "checking") return { label: "checking", color: "#334155", bg: "#e2e8f0", border: "#cbd5e1" };
    return { label: "unknown", color: "#92400e", bg: "#fef3c7", border: "#fde68a" };
  };

  return (
    <>
      <PageHero
        badgeText="£"
        title="Billing & limits"
        lead="Transparent plan, usage, and limits per organisation. Subscribe with Stripe when you are ready."
      />

      {isPlatformOwner && (
        <div style={{ marginBottom: 12 }}>
          <InlineAlert
            type="info"
            text="You are signed in as the platform owner. Usage limits in this app are shown as unlimited for your workspace (billing with Stripe still follows your organisation if you subscribe)."
          />
        </div>
      )}

      {actionError && (
        <div style={{ marginBottom: 12 }}>
          <InlineAlert type="error" text={actionError} />
        </div>
      )}

      {!cloudOk && (
        <div style={{ marginBottom: 12 }}>
          <InlineAlert
            type="warn"
            text="Cloud sign-in is not configured. Billing actions require Supabase (same as account sign-in)."
          />
        </div>
      )}
      {cloudOk && isAdmin && stripeFnStatus === "checking" && (
        <div style={{ marginBottom: 12 }}>
          <InlineAlert type="info" text="Checking Stripe Edge Function availability…" />
        </div>
      )}
      {cloudOk && isAdmin && stripeFnStatus === "missing" && (
        <div style={{ marginBottom: 12 }}>
          <InlineAlert
            type="warn"
            text="Stripe billing functions are missing on this Supabase project. Deploy: stripe-checkout, stripe-portal, stripe-webhook."
          />
        </div>
      )}
      {cloudOk && isAdmin && stripeFnStatus === "misconfigured" && (
        <div style={{ marginBottom: 12 }}>
          <InlineAlert
            type="warn"
            text="stripe-checkout is deployed but not configured. Set STRIPE_SECRET_KEY, STRIPE_PRICE_STARTER/TEAM/BUSINESS/ENTERPRISE and SITE_URL in Supabase Edge Function secrets."
          />
        </div>
      )}
      {cloudOk && isAdmin && stripeFnStatus === "probe_failed" && (
        <div style={{ marginBottom: 12 }}>
          <InlineAlert
            type="info"
            text="Could not verify Edge Functions from this browser. You can still try Subscribe — if it fails, deploy stripe-checkout / stripe-portal on your Supabase project or check ad-blockers and network."
          />
        </div>
      )}
      {cloudOk &&
        isAdmin &&
        Number(stripeFnDiagnostics["stripe-webhook"]?.pendingFailures || 0) > 0 && (
          <div style={{ marginBottom: 12 }}>
            <InlineAlert
              type="warn"
              text={`Stripe webhook has ${stripeFnDiagnostics["stripe-webhook"]?.pendingFailures} pending failure(s). Run npm run stripe:retry-webhooks and review function logs.`}
            />
          </div>
        )}

      {cloudOk && isAdmin && (
        <div style={{ ...ss.card, marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Billing health</div>
          <div style={{ display: "grid", gap: 8 }}>
            {STRIPE_FN_KEYS.map((fn) => {
              const state = stripeFnHealth[fn] || "unknown";
              const chip = healthChip(state);
              return (
                <div
                  key={fn}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap", padding: "8px 0", borderBottom: "0.5px solid var(--color-border-tertiary,#e5e5e5)" }}
                >
                  <div style={{ fontSize: 13, color: "var(--color-text-primary)" }}>{fn}</div>
                  <span style={{ ...ss.chip, color: chip.color, background: chip.bg, borderColor: chip.border }}>{chip.label}</span>
                </div>
              );
            })}
          </div>
          <p style={{ margin: "10px 0 0", fontSize: 11, color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
            Missing functions must be deployed in Supabase: <code>stripe-checkout</code>, <code>stripe-portal</code>, <code>stripe-webhook</code>.
          </p>
          <div style={{ marginTop: 8, fontSize: 11, color: "var(--color-text-secondary)", lineHeight: 1.45 }}>
            <div>Last health check: {formatDateTime(lastHealthCheckAt)}</div>
            <div>Last billing request id: {lastActionRequestId || "n/a"}</div>
            <div>
              Webhook last processed: {formatDateTime(stripeFnDiagnostics["stripe-webhook"]?.lastProcessedAt)}
            </div>
            <div>
              Webhook pending failures: {stripeFnDiagnostics["stripe-webhook"]?.pendingFailures ?? "n/a"}
            </div>
          </div>
        </div>
      )}

      <div style={{ ...ss.card, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Current plan</div>
        <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--color-text-secondary)" }}>
          <strong>{plan.name}</strong> — {plan.priceLabel} / {plan.interval}
          {trialStatus?.isActive && !paidActive
            ? ` · ${trialStatus.remainingDays} day${trialStatus.remainingDays === 1 ? "" : "s"} left in trial`
            : ""}
          {paidActive ? ` · Stripe: ${billing.subscriptionStatus}` : ""}
        </p>
        {!trialStatus?.isActive && !paidActive && (
          <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--color-text-secondary)" }}>
            Trial ended. Free-tier limits apply until you subscribe to a paid plan.
          </p>
        )}
        {isAdmin && cloudOk && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)" }}>Subscribe (Stripe Checkout)</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {STRIPE_SUBSCRIBABLE_PLAN_IDS.map((id) => {
                const p = BILLING_PLANS[id];
                const loading = checkoutLoading === id;
                return (
                  <button
                    key={id}
                    type="button"
                    disabled={!stripeCheckoutEnabled || Boolean(checkoutLoading) || loading}
                    onClick={() => startCheckout(id)}
                    style={{
                      ...ss.btnP,
                      fontSize: 13,
                      opacity: (!stripeCheckoutEnabled || (checkoutLoading && !loading)) ? 0.6 : 1,
                    }}
                  >
                    {loading ? "Redirecting…" : `${p.name} (${p.priceLabel}/mo)`}
                  </button>
                );
              })}
              <a
                href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("MySafeOps Enterprise Plus")}`}
                style={{
                  ...ss.btn,
                  fontSize: 13,
                  alignSelf: "center",
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "1px solid var(--color-border-secondary, #cbd5e1)",
                  color: "var(--color-text-primary)",
                }}
              >
                Enterprise Plus (contact)
              </a>
            </div>
            <button
              type="button"
              disabled={!stripePortalEnabled || portalLoading || Boolean(checkoutLoading)}
              onClick={openPortal}
              style={{ ...ss.btn, fontSize: 13, alignSelf: "flex-start", opacity: stripePortalEnabled ? 1 : 0.6 }}
            >
              {portalLoading ? "Opening…" : "Manage billing (portal)"}
            </button>
            <p style={{ margin: 0, fontSize: 11, color: "var(--color-text-secondary)", lineHeight: 1.45 }}>
              Uses Supabase Edge Functions with your Stripe secret keys — not exposed to the browser. Configure Price IDs and webhook in the README.
            </p>
          </div>
        )}
        {!isAdmin && (
          <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--color-text-secondary)" }}>
            Only organisation admins can start or change subscriptions.
          </p>
        )}
        <p style={{ margin: "12px 0 0", fontSize: 12, color: "var(--color-text-secondary)" }}>
          Need upgrade or invoice details?{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: "#0d9488", fontWeight: 500 }}>
            {SUPPORT_EMAIL}
          </a>
        </p>
      </div>

      <div style={{ ...ss.card, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 10 }}>Usage vs limits ({orgId})</div>
        <div style={{ display: "grid", gap: 10 }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
              <span>Workers</span>
              <span>
                {usage.workers} / {limits.workers}
              </span>
            </div>
            <div style={{ height: 8, background: "#e2e8f0", borderRadius: 999 }}>
              <div
                style={{
                  height: "100%",
                  width: `${workersPct}%`,
                  background: workersPct >= 90 ? "#ef4444" : "#0d9488",
                  borderRadius: 999,
                }}
              />
            </div>
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
              <span>Projects</span>
              <span>
                {usage.projects} / {limits.projects}
              </span>
            </div>
            <div style={{ height: 8, background: "#e2e8f0", borderRadius: 999 }}>
              <div
                style={{
                  height: "100%",
                  width: `${projectsPct}%`,
                  background: projectsPct >= 90 ? "#ef4444" : "#0d9488",
                  borderRadius: 999,
                }}
              />
            </div>
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
              <span>Estimated cloud backup size</span>
              <span>
                {formatBytes(usage.cloudBytesEstimate)} / {formatBytes(limits.cloudBytes)}
              </span>
            </div>
            <div style={{ height: 8, background: "#e2e8f0", borderRadius: 999 }}>
              <div
                style={{
                  height: "100%",
                  width: `${storagePct}%`,
                  background: storagePct >= 90 ? "#ef4444" : "#0d9488",
                  borderRadius: 999,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <div style={{ ...ss.card, marginBottom: 24 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Plan comparison</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "8px 6px", borderBottom: "1px solid #e2e8f0" }}>Plan</th>
                <th style={{ textAlign: "left", padding: "8px 6px", borderBottom: "1px solid #e2e8f0" }}>Price</th>
                <th style={{ textAlign: "left", padding: "8px 6px", borderBottom: "1px solid #e2e8f0" }}>Workers</th>
                <th style={{ textAlign: "left", padding: "8px 6px", borderBottom: "1px solid #e2e8f0" }}>Projects</th>
                <th style={{ textAlign: "left", padding: "8px 6px", borderBottom: "1px solid #e2e8f0" }}>Cloud backup</th>
              </tr>
            </thead>
            <tbody>
              {BILLING_COMPARISON_PLAN_IDS.map((cid) => {
                const p = getPlanByComparisonId(cid);
                if (!p) return null;
                return (
                  <tr key={p.id}>
                    <td style={{ padding: "8px 6px", borderBottom: "1px solid #f1f5f9" }}>{p.name}</td>
                    <td style={{ padding: "8px 6px", borderBottom: "1px solid #f1f5f9" }}>
                      {p.priceLabel}/{p.interval}
                    </td>
                    <td style={{ padding: "8px 6px", borderBottom: "1px solid #f1f5f9" }}>
                      {formatLimitCount(p.limits.workers)}
                    </td>
                    <td style={{ padding: "8px 6px", borderBottom: "1px solid #f1f5f9" }}>
                      {formatLimitCount(p.limits.projects)}
                    </td>
                    <td style={{ padding: "8px 6px", borderBottom: "1px solid #f1f5f9" }}>
                      {formatStorageLimit(p.limits.cloudBytes)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
