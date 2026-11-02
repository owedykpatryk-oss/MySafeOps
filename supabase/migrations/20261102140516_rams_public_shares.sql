-- Published RAMS snapshots for read-only links that work across browser profiles.
-- A random capability token is the only public lookup path; table rows are private.

create table public.rams_public_shares (
  token text primary key check (token ~ '^r_[a-f0-9]{32,48}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  org_slug text not null,
  document jsonb not null check (jsonb_typeof(document) = 'object'),
  active boolean not null default true,
  expires_at timestamptz not null,
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index rams_public_shares_owner_idx on public.rams_public_shares (user_id);

alter table public.rams_public_shares enable row level security;

create policy "rams_public_shares_owner_all"
  on public.rams_public_shares for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.rams_public_shares from public, anon;
grant select, insert, update, delete on public.rams_public_shares to authenticated;

create function public.fetch_rams_public_share(p_token text)
returns jsonb
language sql
security definer
set search_path = pg_catalog, public
stable
as $$
  select jsonb_build_object('document', document, 'expiresAt', expires_at)
  from public.rams_public_shares
  where token = p_token
    and active = true
    and expires_at > now()
  limit 1;
$$;

revoke all on function public.fetch_rams_public_share(text) from public;
grant execute on function public.fetch_rams_public_share(text) to anon, authenticated;

comment on function public.fetch_rams_public_share(text) is
  'Intentional public capability lookup. Only a valid unexpired random token returns one read-only RAMS snapshot.';
