import { getBillingEntitlements } from "../utils/orgMembership";
import { AU_PLAN_PRICE_LABELS } from "../config/auPricing";
import { PL_PLAN_PRICE_LABELS } from "../config/plPricing";

/** Effectively unlimited limits for the platform owner login — client UX after `user_is_platform_owner` RPC. */
export const PLATFORM_OWNER_PLAN = {
  id: "platform_owner",
  name: "Platform owner",
  priceLabel: "—",
  interval: "—",
  limits: {
    workers: 10_000_000,
    projects: 10_000_000,
    cloudBytes: Number.MAX_SAFE_INTEGER,
  },
  includes: ["Unlimited workers, projects and storage estimate for this login only"],
};

/** Plans with a Stripe Checkout price (`STRIPE_PRICE_*`). Keep in sync with Edge Functions + seed script. */
export const STRIPE_SUBSCRIBABLE_PLAN_IDS = ["starter", "team", "business", "enterprise"];

/** Annual list-price review cap — keep in sync with Terms §7.5 and pricing footnotes. */
export const ANNUAL_PRICE_INCREASE_PERCENT = 10;

/** Short footnote for pricing tables and billing (UK / default English). */
export const PRICE_ADJUSTMENT_SHORT =
  "Published list prices are reviewed once a year (up to 10% at renewal, with at least 30 days’ notice). Your current billing period is never repriced mid-term.";

/** FAQ / longer copy with legal pointer (UK / default English). */
export const PRICE_ADJUSTMENT_DETAIL =
  "We review published list prices once a year. Any increase is capped at 10% and applies from your next renewal after at least 30 days’ email notice — never mid-term on your current period. Enterprise Plus is agreed separately in writing.";

const PRICE_ADJUSTMENT_SHORT_PL =
  "Opublikowane ceny katalogowe są przeglądane raz w roku (do 10% przy odnowieniu, z co najmniej 30-dniowym wyprzedzeniem). Bieżący okres rozliczeniowy nie jest nigdy zmieniany w trakcie trwania.";

const PRICE_ADJUSTMENT_DETAIL_PL =
  "Przeglądamy opublikowane ceny katalogowe raz w roku. Podwyżka jest ograniczona do 10% i obowiązuje od kolejnego odnowienia po co najmniej 30 dniach powiadomienia e-mailem — nigdy w trakcie bieżącego okresu. Enterprise Plus ustalane jest osobno na piśmie.";

/**
 * @param {import("../config/markets").MarketId | string} [marketId]
 * @returns {string}
 */
export function getPriceAdjustmentShort(marketId = "uk") {
  return marketId === "pl" ? PRICE_ADJUSTMENT_SHORT_PL : PRICE_ADJUSTMENT_SHORT;
}

/**
 * @param {import("../config/markets").MarketId | string} [marketId]
 * @returns {string}
 */
export function getPriceAdjustmentDetail(marketId = "uk") {
  return marketId === "pl" ? PRICE_ADJUSTMENT_DETAIL_PL : PRICE_ADJUSTMENT_DETAIL;
}

/** Row order for the in-app comparison table (includes non-Stripe tiers). */
export const BILLING_COMPARISON_PLAN_IDS = [
  "trial",
  "expired",
  "starter",
  "team",
  "business",
  "enterprise",
  "enterprise_plus",
];

export const BILLING_PLANS = {
  /** Legacy reference — not offered after evaluation trial ends. */
  free: {
    id: "free",
    name: "Free (legacy)",
    priceLabel: "—",
    interval: "retired",
    limits: {
      workers: 0,
      projects: 0,
      cloudBytes: 0,
    },
    includes: ["Replaced by evaluation trial + paid plans"],
  },
  starter: {
    id: "starter",
    name: "Solo",
    priceLabel: "£19",
    interval: "month",
    limits: {
      workers: 5,
      projects: 100,
      cloudBytes: 2_000_000_000,
    },
    includes: [
      "Up to 5 workers",
      "100 active projects",
      "Full module library (construction, food/pharma, survey)",
      "2GB cloud backup",
      "Email support",
    ],
  },
  team: {
    id: "team",
    name: "Team",
    priceLabel: "£99",
    interval: "month",
    limits: {
      workers: 20,
      projects: 500,
      cloudBytes: 10_000_000_000,
    },
    includes: [
      "Up to 20 workers",
      "500 active projects",
      "Full module library (same as all paid plans)",
      "10GB cloud backup",
      "Priority support",
    ],
  },
  business: {
    id: "business",
    name: "Business",
    priceLabel: "£249",
    interval: "month",
    limits: {
      workers: 75,
      projects: 2_500,
      cloudBytes: 50_000_000_000,
    },
    includes: [
      "Up to 75 workers",
      "2,500 active projects",
      "Full module library (same as all paid plans)",
      "50GB cloud backup",
      "Dedicated onboarding",
      "Tamper-evident audit log",
    ],
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    priceLabel: "£499",
    interval: "month",
    limits: {
      workers: 200,
      projects: 10_000,
      cloudBytes: 200_000_000_000,
    },
    includes: [
      "Up to 200 workers",
      "10,000 active projects",
      "Full module library (same as all paid plans)",
      "200GB cloud backup",
      "Dedicated onboarding",
      "Tamper-evident audit log",
      "Group MI dashboard",
      "Custom subdomain",
      "SLA and named support",
    ],
  },
  enterprise_plus: {
    id: "enterprise_plus",
    name: "Enterprise Plus",
    priceLabel: "Contact us",
    interval: "custom",
    limits: {
      workers: Number.MAX_SAFE_INTEGER,
      projects: Number.MAX_SAFE_INTEGER,
      cloudBytes: Number.MAX_SAFE_INTEGER,
    },
    includes: [
      "Unlimited workers and projects",
      "Unlimited storage",
      "Full module library",
      "Custom onboarding and training",
      "Tamper-evident audit log",
      "Group MI dashboard",
      "Multi-subsidiary management",
      "Custom integrations",
      "Dedicated account manager",
      "Custom SLA",
    ],
  },
};

export const TRIAL_PLAN = {
  id: "trial",
  name: "Evaluation trial",
  priceLabel: "£0",
  interval: "14 days (+ optional 14)",
  limits: {
    workers: 200,
    projects: 100,
    cloudBytes: 10_000_000_000,
  },
  includes: [
    "Full module library — all registers and RAMS sections",
    "One free +14 day extension per organisation",
    "Up to 100 projects and 200 workers during evaluation",
    "Cloud backup enabled",
  ],
};

/** After trial ends without a paid subscription — view/export only. */
export const EXPIRED_PLAN = {
  id: "expired",
  name: "Trial ended",
  priceLabel: "Subscribe",
  interval: "read-only",
  limits: {
    workers: 0,
    projects: 0,
    cloudBytes: 0,
  },
  includes: [
    "View and export existing records",
    "Organisation settings still editable (branding, sectors, automation)",
    "No new RAMS, permits, workers or projects",
    "Subscribe to resume editing site records",
  ],
};

/** Offline / local-only workspace without cloud trial metadata. */
export const LOCAL_WORKSPACE_PLAN = {
  id: "local",
  name: "Local workspace",
  priceLabel: "—",
  interval: "offline",
  limits: {
    workers: 200,
    projects: 100,
    cloudBytes: 10_000_000_000,
  },
  includes: ["Full local editing without cloud billing"],
};

export function getPlanByComparisonId(id) {
  if (id === "trial") return TRIAL_PLAN;
  if (id === "expired") return EXPIRED_PLAN;
  return BILLING_PLANS[id] ?? null;
}

export function getEffectivePlanId(trialStatus, billing) {
  const b = billing ?? getBillingEntitlements();
  const paidActive =
    (b.subscriptionStatus === "active" || b.subscriptionStatus === "trialing") && b.paidPlanId;
  if (paidActive) return b.paidPlanId;
  // Keep paid limits during past_due dunning (write access gated separately by grace window).
  if (b.subscriptionStatus === "past_due" && b.paidPlanId) return b.paidPlanId;
  if (trialStatus?.isActive) return "trial";
  if (trialStatus && !trialStatus.isActive) return "expired";
  return "local";
}

/**
 * @param {{ isPlatformOwner?: boolean }} [options] When true (platform owner email), billing UI uses unlimited limits.
 */
export function getEffectivePlan(trialStatus, billing, options) {
  if (options?.isPlatformOwner) return PLATFORM_OWNER_PLAN;
  const id = getEffectivePlanId(trialStatus, billing);
  if (id === "trial") return TRIAL_PLAN;
  if (id === "expired") return EXPIRED_PLAN;
  if (id === "local") return LOCAL_WORKSPACE_PLAN;
  return BILLING_PLANS[id] ?? EXPIRED_PLAN;
}

export function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  if (value < 1000) return `${value} B`;
  if (value < 1_000_000) return `${(value / 1000).toFixed(1)} KB`;
  if (value < 1_000_000_000) return `${(value / 1_000_000).toFixed(1)} MB`;
  return `${(value / 1_000_000_000).toFixed(1)} GB`;
}

/** Human-readable cap for comparison tables (unlimited tiers). */
export function formatLimitCount(n) {
  if (!Number.isFinite(n) || n >= 999_999_999) return "Unlimited";
  return String(Math.trunc(n));
}

export function formatStorageLimit(bytes) {
  if (!Number.isFinite(bytes) || bytes >= 9e15) return "Unlimited";
  return formatBytes(bytes);
}

/** Display price for billing UI — AUD labels for AU orgs when configured. */
export function getPlanDisplayPriceLabel(planId, marketId = "uk") {
  if (marketId === "au" && AU_PLAN_PRICE_LABELS[planId]) return AU_PLAN_PRICE_LABELS[planId];
  if (marketId === "pl" && PL_PLAN_PRICE_LABELS[planId]) return PL_PLAN_PRICE_LABELS[planId];
  const plan = planId === "trial" ? TRIAL_PLAN : BILLING_PLANS[planId];
  return plan?.priceLabel ?? "—";
}
