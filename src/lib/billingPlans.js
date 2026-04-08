export const BILLING_PLANS = {
  trial: {
    id: "trial",
    name: "Trial",
    priceLabel: "£0",
    interval: "14 days",
    limits: {
      workers: 200,
      projects: 50,
      cloudBytes: 2_000_000_000,
    },
    includes: ["All core modules", "Cloud backup enabled", "Google/Email sign-in"],
  },
  starter: {
    id: "starter",
    name: "Starter",
    priceLabel: "£19",
    interval: "month",
    limits: {
      workers: 25,
      projects: 10,
      cloudBytes: 2_000_000_000,
    },
    includes: ["Core modules", "Cloud backup", "Email support"],
  },
  team: {
    id: "team",
    name: "Team",
    priceLabel: "£49",
    interval: "month",
    limits: {
      workers: 200,
      projects: 80,
      cloudBytes: 10_000_000_000,
    },
    includes: ["Everything in Starter", "Higher limits", "Priority support"],
  },
  business: {
    id: "business",
    name: "Business",
    priceLabel: "£99",
    interval: "month",
    limits: {
      workers: 2000,
      projects: 500,
      cloudBytes: 50_000_000_000,
    },
    includes: ["Everything in Team", "Enterprise limits", "Dedicated onboarding"],
  },
};

export function getEffectivePlanId(trialStatus) {
  return trialStatus?.isActive ? "trial" : "starter";
}

export function getEffectivePlan(trialStatus) {
  return BILLING_PLANS[getEffectivePlanId(trialStatus)];
}

export function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  if (value < 1000) return `${value} B`;
  if (value < 1_000_000) return `${(value / 1000).toFixed(1)} KB`;
  if (value < 1_000_000_000) return `${(value / 1_000_000).toFixed(1)} MB`;
  return `${(value / 1_000_000_000).toFixed(1)} GB`;
}

