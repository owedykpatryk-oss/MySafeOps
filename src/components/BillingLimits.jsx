import { useEffect, useMemo, useState } from "react";
import { useApp } from "../context/AppContext";
import { useToast } from "../context/ToastContext";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { BILLING_PLANS, formatBytes, getEffectivePlan } from "../lib/billingPlans";
import { refreshOrgFromSupabase } from "../utils/orgMembership";
import { ms } from "../utils/moduleStyles";
import InlineAlert from "./InlineAlert";
import PageHero from "./PageHero";

const ss = ms;
const SUPPORT_EMAIL = "mysafeops@gmail.com";
const NO_MEMBERSHIP_MSG = "No organisation membership";

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

export default function BillingLimits({ checkoutReturn = null }) {
  const { orgId, trialStatus, billing, role } = useApp();
  const { pushToast } = useToast();
  const plan = getEffectivePlan(trialStatus, billing);
  const [checkoutLoading, setCheckoutLoading] = useState(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [actionError, setActionError] = useState(null);

  const isAdmin = role === "admin";
  const cloudOk = isSupabaseConfigured() && supabase;

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
    const first = await supabase.functions.invoke(fnName, { body });
    const firstMsg = first?.error?.message || first?.data?.error || "";
    if (!String(firstMsg).toLowerCase().includes("no organisation membership")) {
      return first;
    }
    await refreshOrgFromSupabase(supabase);
    return supabase.functions.invoke(fnName, { body });
  };

  const startCheckout = async (planId) => {
    setActionError(null);
    if (!supabase) {
      setActionError("Sign in with cloud account to manage subscriptions.");
      return;
    }
    setCheckoutLoading(planId);
    try {
      const { data, error } = await invokeStripeFunctionWithRecovery("stripe-checkout", { planId });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error("No checkout URL returned");
    } catch (e) {
      const raw = e?.message || "Could not start checkout";
      const msg = raw.toLowerCase().includes("no organisation membership")
        ? `${NO_MEMBERSHIP_MSG}. Please sign out and sign in again.`
        : raw;
      setActionError(msg);
      pushToast({ type: "error", message: msg });
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
    setPortalLoading(true);
    try {
      const { data, error } = await invokeStripeFunctionWithRecovery("stripe-portal", {});
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error("No portal URL returned");
    } catch (e) {
      const raw = e?.message || "Could not open billing portal";
      const msg = raw.toLowerCase().includes("no organisation membership")
        ? `${NO_MEMBERSHIP_MSG}. Please sign out and sign in again.`
        : raw;
      setActionError(msg);
      pushToast({ type: "error", message: msg });
    } finally {
      setPortalLoading(false);
    }
  };

  const paidActive =
    (billing?.subscriptionStatus === "active" || billing?.subscriptionStatus === "trialing") &&
    billing?.paidPlanId;

  return (
    <>
      <PageHero
        badgeText="£"
        title="Billing & limits"
        lead="Transparent plan, usage, and limits per organisation. Subscribe with Stripe when you are ready."
      />

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
            Trial ended. Starter limits apply until you subscribe to a paid plan.
          </p>
        )}
        {isAdmin && cloudOk && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)" }}>Subscribe (Stripe Checkout)</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {(["starter", "team", "business"]).map((id) => {
                const p = BILLING_PLANS[id];
                const loading = checkoutLoading === id;
                return (
                  <button
                    key={id}
                    type="button"
                    disabled={Boolean(checkoutLoading) || loading}
                    onClick={() => startCheckout(id)}
                    style={{
                      ...ss.btnP,
                      fontSize: 13,
                      opacity: checkoutLoading && !loading ? 0.6 : 1,
                    }}
                  >
                    {loading ? "Redirecting…" : `${p.name} (${p.priceLabel}/mo)`}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              disabled={portalLoading || Boolean(checkoutLoading)}
              onClick={openPortal}
              style={{ ...ss.btn, fontSize: 13, alignSelf: "flex-start" }}
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
              {Object.values(BILLING_PLANS).map((p) => (
                <tr key={p.id}>
                  <td style={{ padding: "8px 6px", borderBottom: "1px solid #f1f5f9" }}>{p.name}</td>
                  <td style={{ padding: "8px 6px", borderBottom: "1px solid #f1f5f9" }}>
                    {p.priceLabel}/{p.interval}
                  </td>
                  <td style={{ padding: "8px 6px", borderBottom: "1px solid #f1f5f9" }}>{p.limits.workers}</td>
                  <td style={{ padding: "8px 6px", borderBottom: "1px solid #f1f5f9" }}>{p.limits.projects}</td>
                  <td style={{ padding: "8px 6px", borderBottom: "1px solid #f1f5f9" }}>{formatBytes(p.limits.cloudBytes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
