-- MySafeOps: encrypted-at-rest JSON backup per user + org slug (browser bundle)
-- Run in Supabase SQL Editor or: supabase db push (when linked)

create table if not exists public.app_sync (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  org_slug text not null default 'default',
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  constraint app_sync_user_org unique (user_id, org_slug)
);

create index if not exists app_sync_user_id_idx on public.app_sync (user_id);

alter table public.app_sync enable row level security;

create policy "app_sync_select_own"
  on public.app_sync for select
  using (auth.uid() = user_id);

create policy "app_sync_insert_own"
  on public.app_sync for insert
  with check (auth.uid() = user_id);

create policy "app_sync_update_own"
  on public.app_sync for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "app_sync_delete_own"
  on public.app_sync for delete
  using (auth.uid() = user_id);

comment on table public.app_sync is 'Full MySafeOps JSON backup bundle per Supabase user and org slug';
