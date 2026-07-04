-- Client portal: publish read-only compliance snapshots for cross-device ?portal= links.
-- Public access via RPC only (token lookup) — no table enumeration for anon.

create table if not exists public.client_portal_shares (
  token text primary key check (char_length(token) >= 16),
  user_id uuid not null references auth.users on delete cascade,
  org_slug text not null default 'default',
  portal jsonb not null,
  snapshot jsonb not null,
  active boolean not null default true,
  expires_at timestamptz,
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists client_portal_shares_user_idx on public.client_portal_shares (user_id);

alter table public.client_portal_shares enable row level security;

create policy "client_portal_shares_owner_all"
  on public.client_portal_shares
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.fetch_client_portal_share(p_token text)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'portal', portal,
    'snapshot', snapshot
  )
  from public.client_portal_shares
  where token = p_token
    and active = true
    and (expires_at is null or expires_at > now())
  limit 1;
$$;

revoke all on function public.fetch_client_portal_share(text) from public;
grant execute on function public.fetch_client_portal_share(text) to anon, authenticated;

comment on table public.client_portal_shares is 'Published client portal snapshots — public read by token via fetch_client_portal_share RPC';
