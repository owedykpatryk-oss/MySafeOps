-- Stripe webhook dead-letter queue for operational retries.

create table if not exists public.stripe_webhook_failures (
  id bigserial primary key,
  event_id text not null,
  event_type text not null,
  payload jsonb,
  last_error text not null,
  retry_count integer not null default 0,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_retry_at timestamptz,
  resolved_at timestamptz,
  constraint stripe_webhook_failures_status_check check (status in ('pending', 'resolved'))
);

create unique index if not exists stripe_webhook_failures_event_id_idx
  on public.stripe_webhook_failures(event_id);

create index if not exists stripe_webhook_failures_status_created_idx
  on public.stripe_webhook_failures(status, created_at desc);

alter table public.stripe_webhook_failures enable row level security;

drop policy if exists stripe_webhook_failures_no_access on public.stripe_webhook_failures;
create policy stripe_webhook_failures_no_access
  on public.stripe_webhook_failures
  for all
  to public
  using (false)
  with check (false);

comment on table public.stripe_webhook_failures is
  'Dead-letter queue for failed Stripe webhook events. Retried by operational tooling.';
