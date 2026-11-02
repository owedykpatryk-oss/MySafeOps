-- Country workspaces already support DACH; billing must accept the same markets.
alter table public.org_country_workspace_subscriptions
  drop constraint if exists org_country_workspace_subscriptions_market_id_check,
  drop constraint if exists org_country_workspace_subscriptions_currency_check;
alter table public.org_country_workspace_subscriptions
  add constraint org_country_workspace_subscriptions_market_id_check
    check (market_id in ('uk', 'pl', 'au', 'de', 'at', 'ch')),
  add constraint org_country_workspace_subscriptions_currency_check
    check (currency in ('GBP', 'PLN', 'AUD', 'EUR', 'CHF')),
  add constraint org_country_workspace_subscriptions_market_currency_check
    check ((market_id = 'uk' and currency = 'GBP')
      or (market_id = 'pl' and currency = 'PLN')
      or (market_id = 'au' and currency = 'AUD')
      or (market_id in ('de', 'at') and currency = 'EUR')
      or (market_id = 'ch' and currency = 'CHF'));

-- Serialise checkout creation across tabs and Edge isolates, not just one process.
create table public.billing_checkout_locks (
  workspace_id uuid not null references public.org_country_workspaces(id) on delete cascade,
  stripe_mode text not null check (stripe_mode in ('live', 'test')),
  token uuid not null,
  expires_at timestamptz not null,
  primary key (workspace_id, stripe_mode)
);
alter table public.billing_checkout_locks enable row level security;
revoke all on public.billing_checkout_locks from public, anon, authenticated;
grant select, insert, update, delete on public.billing_checkout_locks to service_role;

create or replace function public.acquire_billing_checkout_lock(p_workspace_id uuid, p_stripe_mode text)
returns uuid language sql security invoker set search_path = '' as $$
  insert into public.billing_checkout_locks as locks (workspace_id, stripe_mode, token, expires_at)
  values (p_workspace_id, p_stripe_mode, gen_random_uuid(), now() + interval '2 minutes')
  on conflict (workspace_id, stripe_mode) do update
    set token = excluded.token, expires_at = excluded.expires_at
    where locks.expires_at < now()
  returning token;
$$;
revoke all on function public.acquire_billing_checkout_lock(uuid, text) from public, anon, authenticated;
grant execute on function public.acquire_billing_checkout_lock(uuid, text) to service_role;
