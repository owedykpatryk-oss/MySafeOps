-- FESS Group (slug fess-group) is reserved for Jack + Maciej only.
-- Everyone else: solo org on signup, or join via invite to a non-FESS organisation.

create or replace function public.is_fess_reserved_email(p_email text)
returns boolean
language sql
immutable
as $$
  select lower(trim(coalesce(p_email, ''))) in (
    'jack@fessgroup.co.uk',
    'maciej@fessgroup.co.uk'
  );
$$;

comment on function public.is_fess_reserved_email(text) is
  'True for the two designated FESS Group platform accounts.';

create or replace function public.guard_fess_org_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slug text;
  v_email text;
begin
  if coalesce(current_setting('mysafeops.bypass_fess_guard', true), '') = 'true' then
    return NEW;
  end if;

  select o.slug into v_slug from public.organizations o where o.id = NEW.org_id;
  if v_slug is distinct from 'fess-group' then
    return NEW;
  end if;

  select lower(u.email) into v_email from auth.users u where u.id = NEW.user_id;
  if public.is_fess_reserved_email(v_email) then
    return NEW;
  end if;

  raise exception
    'FESS Group is reserved for designated accounts only. Register for your own workspace, or accept an invite from another organisation.';
end;
$$;

create or replace function public.guard_fess_org_invites()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slug text;
begin
  if coalesce(current_setting('mysafeops.bypass_fess_guard', true), '') = 'true' then
    return NEW;
  end if;

  select o.slug into v_slug from public.organizations o where o.id = NEW.org_id;
  if v_slug = 'fess-group' then
    raise exception
      'Invites to FESS Group are not available. New users should sign up for their own organisation, or join via invite from another company.';
  end if;

  return NEW;
end;
$$;

drop trigger if exists guard_fess_org_membership_trg on public.org_memberships;
create trigger guard_fess_org_membership_trg
  before insert or update of org_id, user_id on public.org_memberships
  for each row execute function public.guard_fess_org_membership();

drop trigger if exists guard_fess_org_invites_trg on public.org_invites;
create trigger guard_fess_org_invites_trg
  before insert on public.org_invites
  for each row execute function public.guard_fess_org_invites();

-- Revoke stale pending invites to FESS (should not exist in normal operation).
update public.org_invites i
set status = 'revoked'
from public.organizations o
where o.id = i.org_id
  and o.slug = 'fess-group'
  and i.status = 'pending';

-- superadmin provision: only Jack + Maciej for fess-group; set bypass for trigger.
create or replace function public.superadmin_provision_org_members(
  p_org_slug text,
  p_org_name text,
  p_emails text[],
  p_role text default 'admin'
)
returns table (
  out_email text,
  out_user_id uuid,
  out_org_slug text,
  out_action text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  v_ok boolean;
  v_org_id uuid;
  v_slug text;
  v_name text;
  v_role text;
  v_owner uuid;
  v_raw text;
  v_norm text;
  v_uid uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select exists (select 1 from public.platform_owner_email_allowlist e where e.email = v_email) into v_ok;
  if not v_ok then
    raise exception 'Not authorized';
  end if;

  v_slug := lower(trim(regexp_replace(coalesce(p_org_slug, ''), '[^a-z0-9]+', '-', 'g')));
  v_slug := trim(both '-' from v_slug);
  if v_slug = '' then
    raise exception 'Invalid organisation slug';
  end if;

  v_name := nullif(trim(coalesce(p_org_name, '')), '');
  if v_name is null then
    raise exception 'Organisation name is required';
  end if;

  v_role := lower(trim(coalesce(p_role, 'admin')));
  if v_role not in ('admin', 'supervisor', 'operative') then
    raise exception 'Invalid role';
  end if;

  if p_emails is null or array_length(p_emails, 1) is null then
    raise exception 'At least one email is required';
  end if;

  perform set_config('mysafeops.bypass_fess_guard', 'true', true);

  select o.id into v_org_id from public.organizations o where o.slug = v_slug limit 1;

  if v_org_id is null then
    v_owner := null;
    foreach v_raw in array p_emails loop
      v_norm := lower(trim(v_raw));
      if v_norm = '' then
        continue;
      end if;
      if v_slug = 'fess-group' and not public.is_fess_reserved_email(v_norm) then
        continue;
      end if;
      select u.id into v_uid from auth.users u where lower(u.email) = v_norm limit 1;
      if v_uid is not null then
        v_owner := v_uid;
        exit;
      end if;
    end loop;

    if v_owner is null then
      raise exception 'No matching auth users found — accounts must sign up first';
    end if;

    insert into public.organizations (slug, name, owner_user_id)
    values (v_slug, v_name, v_owner)
    returning id into v_org_id;
  else
    update public.organizations
    set name = v_name
    where id = v_org_id;
  end if;

  foreach v_raw in array p_emails loop
    out_email := lower(trim(v_raw));
    out_org_slug := v_slug;
    out_user_id := null;
    out_action := 'skipped';

    if out_email = '' then
      out_action := 'empty_email';
      return next;
      continue;
    end if;

    if v_slug = 'fess-group' and not public.is_fess_reserved_email(out_email) then
      out_action := 'fess_reserved_only';
      return next;
      continue;
    end if;

    select u.id into v_uid from auth.users u where lower(u.email) = out_email limit 1;
    if v_uid is null then
      out_action := 'user_not_found';
      return next;
      continue;
    end if;

    out_user_id := v_uid;

    insert into public.org_memberships (user_id, org_id, role)
    values (v_uid, v_org_id, v_role)
    on conflict (user_id) do update
      set org_id = excluded.org_id,
          role = excluded.role;

    out_action := 'attached';
    return next;
  end loop;
end;
$$;

-- ensure_my_org: block joining fess-group via invite unless reserved email.
create or replace function public.ensure_my_org(
  p_org_name text default null,
  p_invite_token text default null
)
returns table (
  org_slug text,
  org_name text,
  trial_ends_at timestamptz,
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

    select o.slug, o.name, o.trial_ends_at, m.role, o.billing_plan, o.subscription_status
      into org_slug, org_name, trial_ends_at, role, billing_plan, subscription_status
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

    select o.slug, o.name, o.trial_ends_at, m.role, o.billing_plan, o.subscription_status
      into org_slug, org_name, trial_ends_at, role, billing_plan, subscription_status
    from public.org_memberships m
    join public.organizations o on o.id = m.org_id
    where m.user_id = v_uid
    limit 1;

    return next;
    return;
  end if;

  select o.slug, o.name, o.trial_ends_at, m.role, o.billing_plan, o.subscription_status
    into org_slug, org_name, trial_ends_at, role, billing_plan, subscription_status
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
  returning o.id, o.slug, o.name, o.trial_ends_at into v_org_id, org_slug, org_name, trial_ends_at;

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

grant execute on function public.is_fess_reserved_email(text) to authenticated;

comment on function public.ensure_my_org(text, text) is
  'Solo org on signup; invite join; fess-group reserved for Jack/Maciej only.';
