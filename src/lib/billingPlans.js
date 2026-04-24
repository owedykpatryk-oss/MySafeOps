import { getBillingEntitlements } from "../utils/orgMembership";

/** Effectively unlimited limits for the platform owner login — client-side UX only (`VITE_PLATFORM_OWNER_EMAIL`). */
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

/** Row order for the in-app comparison table (includes non-Stripe tiers). */
export const BILLING_COMPARISON_PLAN_IDS = [
  "trial",
  "free",
  "starter",
  "team",
  "business",
  "enterprise",
  "enterprise_plus",
];

export const BILLING_PLANS = {
  free: {
    id: "free",
    name: "Free",
    priceLabel: "£0",
    interval: "forever",
    limits: {
      workers: 5,
      projects: 2,
      cloudBytes: 500_000_000,
    },
    includes: ["Core RAMS and permits", "Up to 5 workers", "2 active projects", "Offline-capable"],
  },
  starter: {
    id: "starter",
    name: "Solo",
    priceLabel: "£29",
    interval: "month",
    limits: {
      workers: 5,
      projects: 3,
      cloudBytes: 2_000_000_000,
    },
    includes: [
      "Up to 5 workers",
      "3 active projects",
      "All safety modules",
      "2GB cloud backup",
      "Email support",
    ],
  },
  team: {
    id: "team",
    name: "Team",
    priceLabel: "£79",
    interval: "month",
    limits: {
      workers: 20,
      projects: 10,
      cloudBytes: 10_000_000_000,
    },
    includes: [
      "Up to 20 workers",
      "10 active projects",
      "All safety modules",
      "Industrial Sector Pack",
      "10GB cloud backup",
      "Priority support",
    ],
  },
  business: {
    id: "business",
    name: "Business",
    priceLabel: "£149",
    interval: "month",
    limits: {
      workers: 75,
      projects: 40,
      cloudBytes: 50_000_000_000,
    },
    includes: [
      "Up to 75 workers",
      "40 active projects",
      "All safety modules",
      "Industrial Sector Pack",
      "50GB cloud backup",
      "Dedicated onboarding",
      "Tamper-evident audit log",
    ],
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    priceLabel: "£399",
    interval: "month",
    limits: {
      workers: 150,
      projects: 80,
      cloudBytes: 200_000_000_000,
    },
    includes: [
      "Up to 150 workers",
      "80 active projects",
      "All safety modules",
      "Industrial Sector Pack",
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
      "All safety modules",
      "Industrial Sector Pack",
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
  name: "Trial",
  priceLabel: "£0",
  interval: "14 days",
  limits: {
    workers: 200,
    projects: 50,
    cloudBytes: 10_000_000_000,
  },
  includes: ["All core modules", "Cloud backup enabled", "Google/Email sign-in"],
};

export function getPlanByComparisonId(id) {
  if (id === "trial") return TRIAL_PLAN;
  return BILLING_PLANS[id] ?? null;
}

export function getEffectivePlanId(trialStatus, billing) {
  const b = billing ?? getBillingEntitlements();
  const paidActive =
    (b.subscriptionStatus === "active" || b.subscriptionStatus === "trialing") && b.paidPlanId;
  if (paidActive) return b.paidPlanId;
  if (trialStatus?.isActive) return "trial";
  return "free";
}

/**
 * @param {{ isPlatformOwner?: boolean }} [options] When true (platform owner email), billing UI uses unlimited limits.
 */
export function getEffectivePlan(trialStatus, billing, options) {
  if (options?.isPlatformOwner) return PLATFORM_OWNER_PLAN;
  const id = getEffectivePlanId(trialStatus, billing);
  if (id === "trial") return TRIAL_PLAN;
  return BILLING_PLANS[id] ?? BILLING_PLANS.free;
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
