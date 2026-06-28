import { getEffectivePlan } from "../lib/billingPlans";
import { loadOrgScoped as load } from "./orgStorage";

export function getOrgUsageCounts() {
  return {
    workers: load("mysafeops_workers", []).length,
    projects: load("mysafeops_projects", []).length,
  };
}

/**
 * @param {"workers"|"projects"} kind
 */
export function checkBillingLimit(kind, { trialStatus, billing, isPlatformOwner = false } = {}) {
  const plan = getEffectivePlan(trialStatus, billing, { isPlatformOwner });
  const usage = getOrgUsageCounts();
  const limit = plan?.limits?.[kind];
  const count = usage[kind] ?? 0;
  if (!Number.isFinite(limit) || limit >= 9_999_999) {
    return { ok: true, count, limit, planName: plan?.name || "Plan" };
  }
  if (count >= limit) {
    return { ok: false, count, limit, planName: plan?.name || "Plan", kind };
  }
  return { ok: true, count, limit, planName: plan?.name || "Plan", kind };
}

export function billingLimitMessage(result) {
  if (result?.ok) return "";
  const label = result.kind === "workers" ? "workers" : "projects";
  return `${result.planName} plan allows up to ${result.limit} ${label}. You have ${result.count}. Upgrade in Settings → Billing.`;
}
