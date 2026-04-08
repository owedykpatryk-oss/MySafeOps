-- MySafeOps: one-org-per-user membership with automatic 14-day trial.
-- Run in Supabase SQL Editor or via: supabase db push

create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  owner_user_id uuid not null references auth.users on delete cascade,
  trial_starts_at timestamptz not null default now(),
  trial_ends_at timestamptz not null default (now() + interval '14 days'),
  created_at timestamptz not null default now()
);

create table if not exists public.org_memberships (
  user_id uuid primary key references auth.users on delete cascade,
  org_id uuid not null references public.organizations on delete cascade,
  role text not null default 'admin' check (role in ('admin', 'supervisor', 'operative')),
  created_at timestamptz not null default now()
);

create index if not exists org_memberships_org_id_idx on public.org_memberships (org_id);

alter table public.organizations enable row level security;
alter table public.org_memberships enable row level security;

create policy "organizations_select_member"
  on public.organizations for select
  using (
    exists (
      select 1
      from public.org_memberships m
      where m.org_id = organizations.id
        and m.user_id = auth.uid()
    )
  );

create policy "org_memberships_select_own"
  on public.org_memberships for select
  using (user_id = auth.uid());

create or replace function public.ensure_my_org(p_org_name text default null)
returns table (
  org_slug text,
  org_name text,
  trial_ends_at timestamptz,
  role text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_org_id uuid;
  v_slug text;
  v_name text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select o.slug, o.name, o.trial_ends_at, m.role
    into org_slug, org_name, trial_ends_at, role
  from public.org_memberships m
  join public.organizations o on o.id = m.org_id
  where m.user_id = v_uid
  limit 1;

  if found then
    return next;
    return;
  end if;

  select u.email
    into v_email
  from auth.users u
  where u.id = v_uid;

  v_slug := lower(regexp_replace(split_part(coalesce(v_email, 'org'), '@', 1), '[^a-z0-9]+', '-', 'g'));
  v_slug := trim(both '-' from v_slug);
  if v_slug = '' then
    v_slug := 'org';
  end if;
  v_slug := left(v_slug, 24) || '-' || left(replace(v_uid::text, '-', ''), 8);

  v_name := coalesce(
    nullif(trim(p_org_name), ''),
    initcap(replace(split_part(coalesce(v_email, 'my-safeops-org'), '@', 1), '.', ' ')) || ' Workspace'
  );

  insert into public.organizations (slug, name, owner_user_id)
  values (v_slug, v_name, v_uid)
  returning id, slug, name, trial_ends_at into v_org_id, org_slug, org_name, trial_ends_at;

  insert into public.org_memberships (user_id, org_id, role)
  values (v_uid, v_org_id, 'admin')
  on conflict (user_id) do update
    set org_id = excluded.org_id;

  role := 'admin';
  return next;
end;
$$;

grant execute on function public.ensure_my_org(text) to authenticated;

comment on function public.ensure_my_org(text) is
  'Returns current user org; if missing, auto-creates org + admin membership + 14-day trial.';

