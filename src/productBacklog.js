/**
 * Suggested enhancements (see DOCS/CURSOR_PROMPT.md, DOCS/PRODUCT_SCOPE.md, README.md).
 */
export const PRIORITIZED_BACKLOG_NEXT = {
  id: "realtime-sync",
  title: "Richer cloud sync",
  description: "Beyond JSON snapshot in app_sync: conflict handling, granular tables, or realtime if product needs it.",
};

/** Ordered ideas for planning — not all are committed roadmap items */
export const BACKLOG_SUGGESTIONS = [
  PRIORITIZED_BACKLOG_NEXT,
  {
    id: "ai-proxy",
    title: "Production-safe AI",
    description: "Proxy Anthropic (and similar) via a backend; keep API keys out of VITE_* bundles.",
  },
  {
    id: "pwa-icons",
    title: "PWA polish",
    description: "Add maskable PNG icons (192/512) and tune manifest for install prompts on mobile.",
  },
  {
    id: "global-search",
    title: "Cross-module search",
    description: "Single search across workers, permits, RAMS metadata, and key registers (localStorage scan + indexes).",
  },
  {
    id: "stripe-plans",
    title: "Billing & limits",
    description: "Stripe + plan tiers if moving from single-team tool to multi-tenant SaaS.",
  },
];
