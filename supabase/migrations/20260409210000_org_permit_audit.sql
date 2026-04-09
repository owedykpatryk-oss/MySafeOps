-- Append-only audit trail for permit lifecycle (per Supabase user + org slug).
create table if not exists public.org_permit_audit (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  org_slug text not null default 'default',
  permit_id text not null,
  action text not null,
  from_status text,
  to_status text,
  detail jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists org_permit_audit_user_org_permit_idx
  on public.org_permit_audit (user_id, org_slug, permit_id);

create index if not exists org_permit_audit_occurred_idx
  on public.org_permit_audit (occurred_at desc);

alter table public.org_permit_audit enable row level security;

create policy "org_permit_audit_select_own"
  on public.org_permit_audit for select
  using (auth.uid() = user_id);

create policy "org_permit_audit_insert_own"
  on public.org_permit_audit for insert
  with check (auth.uid() = user_id);

comment on table public.org_permit_audit is 'Append-only PTW change history; written by the app when signed in';
