-- Evaluation trial: optional one-time +14 day extension; no perpetual free tier after trial.

alter table public.organizations
  add column if not exists trial_extension_count int not null default 0;

comment on column public.organizations.trial_extension_count is
  'How many times this org used the one-time +14 day trial extension (max 1).';

-- One-time +14 days for the caller''s organisation (admin/supervisor/operative — any member).
create or replace function public.extend_org_trial()
returns table (
  org_slug text,
  trial_ends_at timestamptz,
  trial_extension_count int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select m.org_id
    into v_org_id
  from public.org_memberships m
  where m.user_id = v_uid
  limit 1;

  if v_org_id is null then
    raise exception 'No organisation membership';
  end if;

  update public.organizations o
  set
    trial_ends_at = greatest(o.trial_ends_at, now()) + interval '14 days',
    trial_extension_count = o.trial_extension_count + 1
  where o.id = v_org_id
    and o.trial_extension_count < 1
  returning o.slug, o.trial_ends_at, o.trial_extension_count
    into org_slug, trial_ends_at, trial_extension_count;

  if not found then
    raise exception 'Trial extension already used or organisation not found';
  end if;

  return next;
end;
$$;

grant execute on function public.extend_org_trial() to authenticated;

comment on function public.extend_org_trial() is
  'Adds 14 days to org trial once per organisation (from max(now, current trial_ends_at)).';

drop function if exists public.ensure_my_org(text, text);

create or replace function public.ensure_my_org(
  p_org_name text default null,
  p_invite_token text default null
)
returns table (
  org_slug text,
  org_name text,
  trial_ends_at timestamptz,
  trial_extension_count int,
  role text,
  billing_plan text,
  subscription_status text
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
  v_target_slug text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select u.email into v_email
  from auth.users u
  where u.id = v_uid;

  if nullif(trim(coalesce(p_invite_token, '')), '') is not null then
    select i.id, i.org_id, i.role
      into v_invite_id, v_org_id, v_invite_role
    from public.org_invites i
    where i.invite_token = p_invite_token
      and i.status = 'pending'
      and i.expires_at > now()
    limit 1;

    if not found then
      raise exception 'Invite token is invalid or expired.';
    end if;

    if lower((select email from public.org_invites where id = v_invite_id)) <> lower(coalesce(v_email, '')) then
      raise exception 'Invite email mismatch. Sign in with the invited email address.';
    end if;

    select o.slug into v_target_slug from public.organizations o where o.id = v_org_id;
    if v_target_slug = 'fess-group' and not public.is_fess_reserved_email(v_email) then
      raise exception
        'This invite targets FESS Group, which is reserved for designated accounts. Register for your own organisation instead.';
    end if;

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

    select o.slug, o.name, o.trial_ends_at, o.trial_extension_count, m.role, o.billing_plan, o.subscription_status
      into org_slug, org_name, trial_ends_at, trial_extension_count, role, billing_plan, subscription_status
    from public.org_memberships m
    join public.organizations o on o.id = m.org_id
    where m.user_id = v_uid
    limit 1;

    return next;
    return;
  end if;

  select i.id, i.org_id, i.role
    into v_invite_id, v_org_id, v_invite_role
  from public.org_invites i
  where i.status = 'pending'
    and i.expires_at > now()
    and lower(i.email) = lower(coalesce(v_email, ''))
  order by i.created_at asc
  limit 1;

  if found then
    select o.slug into v_target_slug from public.organizations o where o.id = v_org_id;
    if v_target_slug = 'fess-group' and not public.is_fess_reserved_email(v_email) then
      raise exception
        'A pending invite targets FESS Group, which is reserved for designated accounts. Register for your own organisation instead.';
    end if;

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

    select o.slug, o.name, o.trial_ends_at, o.trial_extension_count, m.role, o.billing_plan, o.subscription_status
      into org_slug, org_name, trial_ends_at, trial_extension_count, role, billing_plan, subscription_status
    from public.org_memberships m
    join public.organizations o on o.id = m.org_id
    where m.user_id = v_uid
    limit 1;

    return next;
    return;
  end if;

  select o.slug, o.name, o.trial_ends_at, o.trial_extension_count, m.role, o.billing_plan, o.subscription_status
    into org_slug, org_name, trial_ends_at, trial_extension_count, role, billing_plan, subscription_status
  from public.org_memberships m
  join public.organizations o on o.id = m.org_id
  where m.user_id = v_uid
  limit 1;

  if found then
    return next;
    return;
  end if;

  v_slug := lower(regexp_replace(split_part(coalesce(v_email, 'org'), '@', 1), '[^a-z0-9]+', '-', 'g'));
  v_slug := trim(both '-' from v_slug);
  if v_slug = '' then
    v_slug := 'org';
  end if;
  v_slug := left(v_slug, 24) || '-' || left(replace(v_uid::text, '-', ''), 8);

  if v_slug = 'fess-group' then
    v_slug := 'fess-group-' || left(replace(v_uid::text, '-', ''), 8);
  end if;

  v_name := coalesce(
    nullif(trim(p_org_name), ''),
    initcap(replace(split_part(coalesce(v_email, 'my-safeops-org'), '@', 1), '.', ' ')) || ' Workspace'
  );

  insert into public.organizations as o (slug, name, owner_user_id)
  values (v_slug, v_name, v_uid)
  returning o.id, o.slug, o.name, o.trial_ends_at, o.trial_extension_count
    into v_org_id, org_slug, org_name, trial_ends_at, trial_extension_count;

  insert into public.org_memberships (user_id, org_id, role)
  values (v_uid, v_org_id, 'admin')
  on conflict (user_id) do update
    set org_id = excluded.org_id,
        role = excluded.role;

  role := 'admin';
  billing_plan := null;
  subscription_status := 'none';
  return next;
end;
$$;

grant execute on function public.ensure_my_org(text, text) to authenticated;

comment on function public.ensure_my_org(text, text) is
  'Returns org context + trial metadata; creates org with 14-day evaluation trial on first sign-in.';
