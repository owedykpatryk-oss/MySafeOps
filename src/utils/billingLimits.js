import { getEffectivePlan } from "../lib/billingPlans";
import { isBillingWriteBlocked, billingWriteBlockedMessage } from "./billingAccess";
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
  if (isBillingWriteBlocked({ trialStatus, billing, isPlatformOwner })) {
    return {
      ok: false,
      count: getOrgUsageCounts()[kind] ?? 0,
      limit: 0,
      planName: "Trial ended",
      kind,
      readOnly: true,
    };
  }
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
  if (result?.readOnly) return billingWriteBlockedMessage();
  if (result?.ok) return "";
  const label = result.kind === "workers" ? "workers" : "projects";
  return `${result.planName} plan allows up to ${result.limit} ${label}. You have ${result.count}. Upgrade in Settings → Billing.`;
}
