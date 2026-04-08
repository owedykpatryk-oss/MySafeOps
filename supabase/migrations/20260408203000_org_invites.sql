-- MySafeOps: organisation invites and invite-aware org onboarding.

create extension if not exists pgcrypto;

create table if not exists public.org_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations on delete cascade,
  email text not null,
  role text not null default 'operative' check (role in ('admin', 'supervisor', 'operative')),
  invite_token text not null unique,
  invited_by uuid not null references auth.users on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_user_id uuid references auth.users on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists org_invites_org_id_idx on public.org_invites (org_id);
create index if not exists org_invites_email_idx on public.org_invites (lower(email));

alter table public.org_invites enable row level security;

create policy "org_invites_select_org_members"
  on public.org_invites for select
  using (
    exists (
      select 1
      from public.org_memberships m
      where m.org_id = org_invites.org_id
        and m.user_id = auth.uid()
    )
  );

create policy "org_invites_insert_org_admin"
  on public.org_invites for insert
  with check (
    exists (
      select 1
      from public.org_memberships m
      where m.org_id = org_invites.org_id
        and m.user_id = auth.uid()
        and m.role = 'admin'
    )
  );

create policy "org_invites_update_org_admin"
  on public.org_invites for update
  using (
    exists (
      select 1
      from public.org_memberships m
      where m.org_id = org_invites.org_id
        and m.user_id = auth.uid()
        and m.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.org_memberships m
      where m.org_id = org_invites.org_id
        and m.user_id = auth.uid()
        and m.role = 'admin'
    )
  );

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
  v_invite_id uuid;
  v_invite_role text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  -- Existing membership: return immediately.
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

  select u.email into v_email
  from auth.users u
  where u.id = v_uid;

  -- Accept pending invite by email and join that organisation.
  select i.id, i.org_id, i.role
    into v_invite_id, v_org_id, v_invite_role
  from public.org_invites i
  where i.status = 'pending'
    and i.expires_at > now()
    and lower(i.email) = lower(coalesce(v_email, ''))
  order by i.created_at asc
  limit 1;

  if found then
    insert into public.org_memberships (user_id, org_id, role)
    values (v_uid, v_org_id, coalesce(v_invite_role, 'operative'))
    on conflict (user_id) do update
      set org_id = excluded.org_id,
          role = excluded.role;

    update public.org_invites
      set status = 'accepted',
          accepted_user_id = v_uid,
          accepted_at = now()
    where id = v_invite_id;

    select o.slug, o.name, o.trial_ends_at, m.role
      into org_slug, org_name, trial_ends_at, role
    from public.org_memberships m
    join public.organizations o on o.id = m.org_id
    where m.user_id = v_uid
    limit 1;

    return next;
    return;
  end if;

  -- No invite: create a new organisation with 14-day trial.
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
    set org_id = excluded.org_id,
        role = excluded.role;

  role := 'admin';
  return next;
end;
$$;

