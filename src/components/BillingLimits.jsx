import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
  getPlanDisplayPriceLabel,
  PRICE_ADJUSTMENT_SHORT,
} from "../lib/billingPlans";
import { getOrgMarketId } from "../utils/orgMarket";
import { getMarketCurrencySymbol } from "../utils/marketLabels";
import { AU_PRICING_FOOTNOTE } from "../config/auPricing";
import { PL_PRICING_FOOTNOTE } from "../config/plPricing";
import { trackBillingError, trackBillingEvent } from "../lib/billingTelemetry";
import {
  extendOrgTrial,
  getTrialExtensionCount,
  refreshOrgFromSupabase,
} from "../utils/orgMembership";
import {
  canExtendOrgTrial,
  isTrialExpiredWithoutPaid,
  shouldShowTrialExtensionOffer,
  TRIAL_EXTENSION_DAYS,
} from "../utils/billingAccess";
import { showAdminLoginHints } from "../lib/showAdminLoginHints";
import { ms } from "../utils/moduleStyles";
import InlineAlert from "./InlineAlert";
import PageHero from "./PageHero";

const ss = ms;
const SUPPORT_EMAIL = getSupportEmail();
const NO_MEMBERSHIP_MSG = "No organisation membership";
/** Browser health probe — never hit stripe-webhook from the app (Stripe servers POST that). */
const STRIPE_PROBE_KEYS = ["stripe-checkout", "stripe-portal"];
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
  const showDevHints = showAdminLoginHints() || isPlatformOwner;
  const plan = getEffectivePlan(trialStatus, billing, { isPlatformOwner });
  const orgMarketId = getOrgMarketId(orgId);
  const planPriceLabel = getPlanDisplayPriceLabel(plan.id, orgMarketId) || plan.priceLabel;
  const [checkoutLoading, setCheckoutLoading] = useState(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [actionError, setActionError] = useState(null);
  /** unknown | checking | ready | missing | misconfigured | probe_failed */
  const [stripeFnStatus, setStripeFnStatus] = useState("unknown");
  const [stripeFnHealth, setStripeFnHealth] = useState({});
  const [stripeFnDiagnostics, setStripeFnDiagnostics] = useState({});
  const [lastHealthCheckAt, setLastHealthCheckAt] = useState(null);
  const [lastActionRequestId, setLastActionRequestId] = useState(null);
  const [extendLoading, setExtendLoading] = useState(false);

  const isAdmin = role === "admin";
  const cloudOk = isSupabaseConfigured() && supabase;
  const portalReady = stripeFnHealth["stripe-portal"] === "ready";
  const checkoutBlocked = stripeFnStatus === "missing" || stripeFnStatus === "misconfigured";
  const stripeCheckoutEnabled = cloudOk && isAdmin && !checkoutBlocked;
  const stripePortalEnabled = cloudOk && isAdmin && portalReady;
  const stripeTestReady = Boolean(stripeFnDiagnostics["stripe-checkout"]?.testReady);
  const allowTestCheckout =
    stripeTestReady &&
    isAdmin &&
    cloudOk &&
    (showDevHints || import.meta.env.VITE_STRIPE_ALLOW_TEST_CHECKOUT === "true");

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
      setStripeFnHealth(
        Object.fromEntries(STRIPE_FN_KEYS.map((k) => [k, k === "stripe-webhook" ? "server" : "checking"]))
      );
      try {
        const base = String(getSupabaseUrl() || "").replace(/\/$/, "");
        if (!base) throw new Error("Missing Supabase URL");
        const { data: { session } } = await supabase.auth.getSession();
        const probeHeaders = {};
        if (session?.access_token) {
          probeHeaders.Authorization = `Bearer ${session.access_token}`;
        }
        const results = await Promise.all(
          STRIPE_PROBE_KEYS.map(async (fn) => {
            try {
              // Use a simple GET existence check to avoid browser/CORS false negatives from custom-header OPTIONS probes.
              const controller = new AbortController();
              const timer = setTimeout(() => controller.abort(), EDGE_FN_TIMEOUT_MS);
              const res = await fetch(`${base}/functions/v1/${fn}`, {
                method: "GET",
                headers: probeHeaders,
                signal: controller.signal,
              }).finally(
                () => clearTimeout(timer)
              );
              if (res.status === 404) return [fn, "missing"];
              const data = await res.json().catch(() => null);
              if (data?.liveReady === false || res.status === 503) return [fn, "misconfigured", data];
              if (data?.liveReady === true) return [fn, "ready", data];
              if (data?.configured && typeof data.configured === "object") {
                const liveKeys = [
                  "stripeSecretKey",
                  "stripePriceStarter",
                  "stripePriceTeam",
                  "stripePriceBusiness",
                  "stripePriceEnterprise",
                  "siteUrl",
                  "supabaseUrl",
                  "serviceRoleKey",
                ];
                const configuredValues = liveKeys.map((k) => data.configured[k]);
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
        const health = {
          ...Object.fromEntries(results.map(([fn, status]) => [fn, status])),
          "stripe-webhook": "server",
        };
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

  const startCheckout = async (planId, { testMode = false } = {}) => {
    setActionError(null);
    if (!supabase) {
      setActionError("Sign in with cloud account to manage subscriptions.");
      return;
    }
    if (testMode && !allowTestCheckout) {
      setActionError("Stripe test checkout is not available in this environment.");
      return;
    }
    if (!testMode && stripeFnStatus === "missing") {
      const msg = showDevHints
        ? "Stripe Edge Functions are not deployed on this Supabase project (missing stripe-checkout)."
        : "Online subscriptions are not set up on this site yet. Contact support to upgrade.";
      setActionError(msg);
      pushToast({ type: "error", message: msg });
      return;
    }
    if (!testMode && stripeFnStatus === "misconfigured") {
      const msg = showDevHints
        ? "stripe-checkout is deployed but not configured. Add STRIPE_SECRET_KEY, STRIPE_PRICE_* and SITE_URL in Supabase Edge Function secrets."
        : "Billing is temporarily unavailable. Contact support if this persists.";
      setActionError(msg);
      pushToast({ type: "error", message: msg });
      return;
    }
    setCheckoutLoading(testMode ? `test:${planId}` : planId);
    try {
      const { data, error } = await invokeStripeFunctionWithRecovery("stripe-checkout", { planId, testMode, market: orgMarketId });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.requestId) setLastActionRequestId(String(data.requestId));
      if ((orgMarketId === "au" || orgMarketId === "pl") && data?.priceMarket === "uk") {
        pushToast({
          type: "warn",
          message:
            orgMarketId === "pl"
              ? "Ceny PLN nie są skonfigurowane na serwerze — checkout może pokazać GBP. Dodaj STRIPE_PRICE_*_PLN do Supabase Edge secrets."
              : "AUD Stripe prices are not configured on the server — checkout may show GBP. Add STRIPE_PRICE_*_AUD to Supabase Edge secrets.",
        });
      }
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
          ? showDevHints
            ? "Could not reach Supabase Edge Function. Deploy stripe-checkout/stripe-portal on this project and verify network access."
            : "Could not reach the billing service. Try again or contact support."
          : raw;
      setActionError(msg);
      pushToast({ type: "error", message: msg });
      trackBillingError("stripe_checkout_failed", e, { planId });
    } finally {
      setCheckoutLoading(null);
    }
  };

  const openPortal = async ({ testMode = false } = {}) => {
    setActionError(null);
    if (!supabase) {
      setActionError("Sign in with cloud account to manage subscriptions.");
      return;
    }
    if (testMode && !allowTestCheckout) {
      setActionError("Stripe test portal is not available in this environment.");
      return;
    }
    const portalState = stripeFnHealth["stripe-portal"] || "unknown";
    if (portalState === "missing") {
      const msg = showDevHints
        ? "Stripe Edge Functions are not deployed on this Supabase project (missing stripe-portal)."
        : "Billing portal is not available on this site yet. Contact support for invoice or plan changes.";
      setActionError(msg);
      pushToast({ type: "error", message: msg });
      return;
    }
    if (portalState === "misconfigured") {
      const msg = showDevHints
        ? "stripe-portal is deployed but not configured. Add STRIPE_SECRET_KEY and SITE_URL in Supabase Edge Function secrets."
        : "Billing portal is temporarily unavailable. Contact support if this persists.";
      setActionError(msg);
      pushToast({ type: "error", message: msg });
      return;
    }
    setPortalLoading(true);
    try {
      const { data, error } = await invokeStripeFunctionWithRecovery("stripe-portal", { testMode });
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
          ? showDevHints
            ? "Could not reach Supabase Edge Function. Deploy stripe-checkout/stripe-portal on this project and verify network access."
            : "Could not reach the billing service. Try again or contact support."
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
  const trialExtensionCount = getTrialExtensionCount();
  const expiredReadOnly = isTrialExpiredWithoutPaid({ trialStatus, billing, isPlatformOwner });
  const canExtend = canExtendOrgTrial({ billing, isPlatformOwner, trialExtensionCount });
  const showExtendOffer = shouldShowTrialExtensionOffer({ trialStatus, billing, isPlatformOwner, trialExtensionCount });

  const handleExtendTrial = async () => {
    if (!supabase || !canExtend) return;
    setExtendLoading(true);
    setActionError(null);
    try {
      await extendOrgTrial(supabase);
      await refreshOrgFromSupabase(supabase);
      pushToast({
        type: "success",
        message: `Evaluation extended by ${TRIAL_EXTENSION_DAYS} days.`,
      });
    } catch (e) {
      const msg = e?.message || "Could not extend trial.";
      setActionError(msg);
      pushToast({ type: "error", message: msg });
    } finally {
      setExtendLoading(false);
    }
  };

  const healthChip = (status) => {
    if (status === "ready") return { label: "reachable", color: "#0f766e", bg: "#ccfbf1", border: "#99f6e4" };
    if (status === "missing") return { label: "missing", color: "#991b1b", bg: "#fee2e2", border: "#fecaca" };
    if (status === "misconfigured") return { label: "not configured", color: "#9a3412", bg: "#ffedd5", border: "#fed7aa" };
    if (status === "checking") return { label: "checking", color: "#334155", bg: "#e2e8f0", border: "#cbd5e1" };
    if (status === "server") return { label: "Stripe → server only", color: "#334155", bg: "#f1f5f9", border: "#cbd5e1" };
    return { label: "unknown", color: "#92400e", bg: "#fef3c7", border: "#fde68a" };
  };

  return (
    <>
      <PageHero
        badgeText={getMarketCurrencySymbol(orgMarketId)}
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
            text={
              showDevHints
                ? "Stripe billing functions are missing on this Supabase project. Deploy: stripe-checkout, stripe-portal, stripe-webhook."
                : "Online billing is not configured yet. You can still use the app within your current plan limits."
            }
          />
        </div>
      )}
      {cloudOk && isAdmin && stripeFnStatus === "misconfigured" && (
        <div style={{ marginBottom: 12 }}>
          <InlineAlert
            type="warn"
            text={
              showDevHints
                ? "stripe-checkout is deployed but not configured. Set STRIPE_SECRET_KEY, STRIPE_PRICE_STARTER/TEAM/BUSINESS/ENTERPRISE and SITE_URL in Supabase Edge Function secrets."
                : "Billing setup is incomplete. Subscribe buttons may not work until an administrator finishes configuration."
            }
          />
        </div>
      )}
      {cloudOk && isAdmin && stripeFnStatus === "probe_failed" && (
        <div style={{ marginBottom: 12 }}>
          <InlineAlert
            type="info"
            text={
              showDevHints
                ? "Could not verify Edge Functions from this browser. You can still try Subscribe — if it fails, deploy stripe-checkout / stripe-portal on your Supabase project or check ad-blockers and network."
                : "Could not verify billing from this browser. You can still try Subscribe, or contact support if checkout fails."
            }
          />
        </div>
      )}
      {cloudOk && isAdmin && showDevHints && (
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
            <div>Webhook: received by Stripe → Supabase (not probed from this browser).</div>
          </div>
        </div>
      )}

      <div style={{ ...ss.card, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Current plan</div>
        <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--color-text-secondary)" }}>
          <strong>{plan.name}</strong> — {planPriceLabel} / {plan.interval}
          {trialStatus?.isActive && !paidActive
            ? ` · ${trialStatus.remainingDays} day${trialStatus.remainingDays === 1 ? "" : "s"} left in trial`
            : ""}
          {paidActive ? ` · Stripe: ${billing.subscriptionStatus}` : ""}
        </p>
        {orgMarketId === "au" && (
          <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--color-text-secondary)" }}>{AU_PRICING_FOOTNOTE}</p>
        )}
        {orgMarketId === "pl" && (
          <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--color-text-secondary)" }}>{PL_PRICING_FOOTNOTE}</p>
        )}
        {!trialStatus?.isActive && !paidActive && trialStatus && (
          <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--color-text-secondary)" }}>
            {expiredReadOnly
              ? "Evaluation ended — read-only mode. View and export existing records, or subscribe to resume editing."
              : "Sign in with cloud billing to start your organisation evaluation."}
          </p>
        )}
        {trialStatus?.isActive && !paidActive && (
          <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--color-text-secondary)" }}>
            Full module access during evaluation. One free +{TRIAL_EXTENSION_DAYS}-day extension per organisation if you need more site time.
          </p>
        )}
        {showExtendOffer && isAdmin && cloudOk && (
          <div style={{ marginBottom: 10 }}>
            <button
              type="button"
              disabled={extendLoading || !canExtend}
              onClick={() => void handleExtendTrial()}
              style={{ ...ss.btn, fontSize: 13 }}
            >
              {extendLoading ? "Extending…" : `Extend evaluation +${TRIAL_EXTENSION_DAYS} days (once)`}
            </button>
          </div>
        )}
        {isAdmin && cloudOk && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)" }}>Subscribe (Stripe Checkout)</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {STRIPE_SUBSCRIBABLE_PLAN_IDS.map((id) => {
                const p = BILLING_PLANS[id];
                const loading = checkoutLoading === id || checkoutLoading === `test:${id}`;
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
                    {loading ? "Redirecting…" : `${p.name} (${getPlanDisplayPriceLabel(id, orgMarketId) || p.priceLabel}/mo)`}
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
              onClick={() => openPortal()}
              style={{ ...ss.btn, fontSize: 13, alignSelf: "flex-start", opacity: stripePortalEnabled ? 1 : 0.6 }}
            >
              {portalLoading ? "Opening…" : "Manage billing (portal)"}
            </button>
            {allowTestCheckout && (
              <div
                style={{
                  marginTop: 4,
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px dashed var(--color-border-secondary, #cbd5e1)",
                  background: "var(--color-surface-secondary, #f8fafc)",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: 6 }}>
                  QA — Stripe test mode (card 4242 4242 4242 4242)
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {STRIPE_SUBSCRIBABLE_PLAN_IDS.map((id) => {
                    const p = BILLING_PLANS[id];
                    const loading = checkoutLoading === `test:${id}`;
                    return (
                      <button
                        key={`test-${id}`}
                        type="button"
                        disabled={Boolean(checkoutLoading) || loading}
                        onClick={() => startCheckout(id, { testMode: true })}
                        style={{ ...ss.btn, fontSize: 12, opacity: checkoutLoading && !loading ? 0.6 : 1 }}
                      >
                        {loading ? "Redirecting…" : `Test ${p.name}`}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    disabled={portalLoading || Boolean(checkoutLoading)}
                    onClick={() => openPortal({ testMode: true })}
                    style={{ ...ss.btn, fontSize: 12 }}
                  >
                    Test portal
                  </button>
                </div>
                <p style={{ margin: "8px 0 0", fontSize: 11, color: "var(--color-text-secondary)", lineHeight: 1.45 }}>
                  Live Subscribe buttons above stay on production Stripe. Test buttons use Stripe test keys only — no real charges.
                </p>
              </div>
            )}
            <p style={{ margin: 0, fontSize: 11, color: "var(--color-text-secondary)", lineHeight: 1.45 }}>
              {showDevHints
                ? "Uses Supabase Edge Functions with your Stripe secret keys — not exposed to the browser. Configure Price IDs and webhook in the README."
                : "Secure checkout and billing portal powered by Stripe."}
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
        <p style={{ margin: "8px 0 0", fontSize: 11, color: "var(--color-text-secondary)", lineHeight: 1.45 }}>
          {PRICE_ADJUSTMENT_SHORT}{" "}
          <Link to="/terms" style={{ color: "inherit", textDecoration: "underline" }}>
            Terms §7.5
          </Link>
          .
        </p>
      </div>

      <div style={{ ...ss.card, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 10 }}>Usage vs limits</div>
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
                      {(getPlanDisplayPriceLabel(p.id, orgMarketId) || p.priceLabel)}/{p.interval}
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
