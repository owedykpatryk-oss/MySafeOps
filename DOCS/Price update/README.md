# Price update (workshop folder)

Canonical implementations live in the repo root:

- `src/lib/billingPlans.js` — limits, display names, trial vs free fallback
- `scripts/stripe-seed-prices.mjs` — Stripe products/prices (`mysafeops_plan_id` metadata)
- `supabase/functions/stripe-checkout` + `stripe-webhook` — `STRIPE_PRICE_ENTERPRISE` and plan id `enterprise`
- `supabase/migrations/20260425100000_billing_plan_enterprise.sql` — DB allows `enterprise` and `enterprise_plus`

Previously this folder held draft `.js` / `.mjs` copies; those drifted from the repo. **Edit the canonical paths above only** — this README remains as the pointer.
