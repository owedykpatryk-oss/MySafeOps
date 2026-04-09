-- Stripe webhook idempotency storage.
-- Ensures duplicate Stripe event deliveries are processed once.

create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  livemode boolean not null default false,
  processed_at timestamptz not null default now()
);

alter table public.stripe_webhook_events enable row level security;

drop policy if exists stripe_webhook_events_no_access on public.stripe_webhook_events;
create policy stripe_webhook_events_no_access
  on public.stripe_webhook_events
  for all
  to public
  using (false)
  with check (false);

comment on table public.stripe_webhook_events is
  'Processed Stripe webhook events (event_id) for idempotency.';
