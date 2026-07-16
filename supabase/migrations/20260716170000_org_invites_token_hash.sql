-- Dual-read invite token hashing: store SHA-256 hash alongside plaintext for
-- gradual cutover. Preview/accept RPCs match hash OR plaintext so existing
-- invites keep working. Plaintext remains until email-resend / copy-from-list
-- can move to return-once tokens.

create extension if not exists pgcrypto with schema extensions;

alter table public.org_invites
  add column if not exists invite_token_hash text;

update public.org_invites
set invite_token_hash = encode(extensions.digest(convert_to(invite_token, 'UTF8'), 'sha256'), 'hex')
where invite_token is not null
  and (invite_token_hash is null or invite_token_hash = '');

create index if not exists org_invites_token_hash_idx
  on public.org_invites (invite_token_hash)
  where invite_token_hash is not null;

create or replace function public.org_invites_set_token_hash()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  if new.invite_token is not null and nullif(trim(new.invite_token), '') is not null then
    new.invite_token_hash := encode(extensions.digest(convert_to(new.invite_token, 'UTF8'), 'sha256'), 'hex');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_org_invites_token_hash on public.org_invites;
create trigger trg_org_invites_token_hash
before insert or update of invite_token on public.org_invites
for each row execute function public.org_invites_set_token_hash();

create or replace function public.get_invite_preview(p_token text)
returns table (
  org_name text,
  invite_email text,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select o.name::text, i.email::text, i.expires_at
  from public.org_invites i
  join public.organizations o on o.id = i.org_id
  where i.status = 'pending'
    and i.expires_at > now()
    and (
      i.invite_token = p_token
      or i.invite_token_hash = encode(extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'), 'hex')
    )
  limit 1;
$$;

revoke all on function public.get_invite_preview(text) from public;
grant execute on function public.get_invite_preview(text) to anon, authenticated;

-- Same ensure_my_org body as 20260704220000, with invite lookup matching hash OR plaintext.
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
set search_path = public, extensions
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
  v_token_hash text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select u.email into v_email
  from auth.users u
  where u.id = v_uid;

  if nullif(trim(coalesce(p_invite_token, '')), '') is not null then
    v_token_hash := encode(extensions.digest(convert_to(p_invite_token, 'UTF8'), 'sha256'), 'hex');
    select i.id, i.org_id, i.role
      into v_invite_id, v_org_id, v_invite_role
    from public.org_invites i
    where i.status = 'pending'
      and i.expires_at > now()
      and (i.invite_token = p_invite_token or i.invite_token_hash = v_token_hash)
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

revoke all on function public.ensure_my_org(text, text) from public;
grant execute on function public.ensure_my_org(text, text) to authenticated;

comment on function public.ensure_my_org(text, text) is
  'Returns org context + trial metadata; creates org with 14-day evaluation trial on first sign-in. Invite tokens match plaintext or SHA-256 hash.';
