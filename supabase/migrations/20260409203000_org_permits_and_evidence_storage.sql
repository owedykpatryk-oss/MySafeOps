-- Optional per-permit JSON mirror for signed-in users (push from app; localStorage remains source of truth).
create table if not exists public.org_permits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  org_slug text not null default 'default',
  permit_id text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  constraint org_permits_user_org_permit unique (user_id, org_slug, permit_id)
);

create index if not exists org_permits_user_org_idx on public.org_permits (user_id, org_slug);

alter table public.org_permits enable row level security;

create policy "org_permits_select_own"
  on public.org_permits for select
  using (auth.uid() = user_id);

create policy "org_permits_insert_own"
  on public.org_permits for insert
  with check (auth.uid() = user_id);

create policy "org_permits_update_own"
  on public.org_permits for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "org_permits_delete_own"
  on public.org_permits for delete
  using (auth.uid() = user_id);

comment on table public.org_permits is 'Mirror of PTW records per user/org slug; app remains offline-first via localStorage';

-- Private bucket: object path prefix = auth user id (first folder).
insert into storage.buckets (id, name, public)
values ('permit-evidence', 'permit-evidence', false)
on conflict (id) do nothing;

drop policy if exists "permit_evidence_insert_own" on storage.objects;
drop policy if exists "permit_evidence_select_own" on storage.objects;
drop policy if exists "permit_evidence_update_own" on storage.objects;
drop policy if exists "permit_evidence_delete_own" on storage.objects;

create policy "permit_evidence_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'permit-evidence'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "permit_evidence_select_own"
  on storage.objects for select
  using (
    bucket_id = 'permit-evidence'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "permit_evidence_update_own"
  on storage.objects for update
  using (
    bucket_id = 'permit-evidence'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "permit_evidence_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'permit-evidence'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
