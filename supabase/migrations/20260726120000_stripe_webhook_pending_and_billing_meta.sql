-- Webhook idempotency: allow pending (unprocessed) rows so Stripe retries can re-run handlers.
-- Billing renewal metadata + past_due grace window start.

alter table public.stripe_webhook_events
  alter column processed_at drop not null;

alter table public.stripe_webhook_events
  alter column processed_at drop default;

comment on column public.stripe_webhook_events.processed_at is
  'Set when the handler finishes successfully. NULL means insert claimed the event but processing did not complete — Stripe retries should reprocess.';

alter table public.organizations
  add column if not exists stripe_current_period_end timestamptz,
  add column if not exists stripe_cancel_at_period_end boolean not null default false,
  add column if not exists stripe_trial_end timestamptz,
  add column if not exists subscription_past_due_since timestamptz;

comment on column public.organizations.stripe_current_period_end is
  'Stripe subscription.current_period_end (renewal / period boundary).';
comment on column public.organizations.stripe_cancel_at_period_end is
  'Stripe subscription.cancel_at_period_end.';
comment on column public.organizations.stripe_trial_end is
  'Stripe subscription.trial_end when on a trial.';
comment on column public.organizations.subscription_past_due_since is
  'First time subscription_status became past_due — used for write grace window.';
