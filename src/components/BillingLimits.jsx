import { useMemo } from "react";
import { useApp } from "../context/AppContext";
import { BILLING_PLANS, formatBytes, getEffectivePlan } from "../lib/billingPlans";
import { ms } from "../utils/moduleStyles";
import PageHero from "./PageHero";

const ss = ms;
const SUPPORT_EMAIL = "mysafeops@gmail.com";

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
  return total * 2; // rough UTF-16 byte estimate
}

export default function BillingLimits() {
  const { orgId, trialStatus } = useApp();
  const plan = getEffectivePlan(trialStatus);

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

  return (
    <>
      <PageHero
        badgeText="£"
        title="Billing & limits"
        lead="Transparent plan, usage, and limits per organisation. No hidden charges."
      />
      <div style={{ ...ss.card, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Current plan</div>
        <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--color-text-secondary)" }}>
          <strong>{plan.name}</strong> — {plan.priceLabel} / {plan.interval}
          {trialStatus?.isActive ? ` · ${trialStatus.remainingDays} day${trialStatus.remainingDays === 1 ? "" : "s"} left in trial` : ""}
        </p>
        {!trialStatus?.isActive && (
          <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--color-text-secondary)" }}>
            Trial ended. You are on Starter limits by default.
          </p>
        )}
        <p style={{ margin: 0, fontSize: 12, color: "var(--color-text-secondary)" }}>
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
              <span>{usage.workers} / {limits.workers}</span>
            </div>
            <div style={{ height: 8, background: "#e2e8f0", borderRadius: 999 }}>
              <div style={{ height: "100%", width: `${workersPct}%`, background: workersPct >= 90 ? "#ef4444" : "#0d9488", borderRadius: 999 }} />
            </div>
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
              <span>Projects</span>
              <span>{usage.projects} / {limits.projects}</span>
            </div>
            <div style={{ height: 8, background: "#e2e8f0", borderRadius: 999 }}>
              <div style={{ height: "100%", width: `${projectsPct}%`, background: projectsPct >= 90 ? "#ef4444" : "#0d9488", borderRadius: 999 }} />
            </div>
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
              <span>Estimated cloud backup size</span>
              <span>{formatBytes(usage.cloudBytesEstimate)} / {formatBytes(limits.cloudBytes)}</span>
            </div>
            <div style={{ height: 8, background: "#e2e8f0", borderRadius: 999 }}>
              <div style={{ height: "100%", width: `${storagePct}%`, background: storagePct >= 90 ? "#ef4444" : "#0d9488", borderRadius: 999 }} />
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
                  <td style={{ padding: "8px 6px", borderBottom: "1px solid #f1f5f9" }}>{p.priceLabel}/{p.interval}</td>
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

