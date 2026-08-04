-- Reusable, domain-restricted organisation join links.
-- Barnes Fernández receives its own tenant and branding; it does not inherit
-- the Utility Mapping tenant profile or exclusive document artwork.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.org_join_links (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  token_hash text not null unique,
  allowed_email text,
  allowed_email_domain text,
  role text not null default 'operative'
    check (role in ('admin', 'supervisor', 'operative')),
  status text not null default 'active'
    check (status in ('active', 'revoked')),
  expires_at timestamptz not null,
  max_uses int check (max_uses is null or max_uses > 0),
  use_count int not null default 0 check (use_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, name),
  check (
    nullif(trim(coalesce(allowed_email, '')), '') is not null
    or nullif(trim(coalesce(allowed_email_domain, '')), '') is not null
  )
);

create index if not exists org_join_links_org_id_idx
  on public.org_join_links(org_id);

alter table public.org_join_links enable row level security;
revoke all on table public.org_join_links from anon, authenticated;

create table if not exists public.org_join_link_uses (
  link_id uuid not null references public.org_join_links(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  used_at timestamptz not null default now(),
  primary key (link_id, user_id)
);

alter table public.org_join_link_uses enable row level security;
revoke all on table public.org_join_link_uses from anon, authenticated;

-- Preserve the email-specific, one-time invite implementation and wrap it with
-- reusable organisation links. The public RPC name remains unchanged.
alter function public.get_invite_preview(text)
  rename to get_email_invite_preview;

create function public.get_invite_preview(p_token text)
returns table (
  org_name text,
  invite_email text,
  expires_at timestamptz,
  logo_url text,
  primary_color text,
  accent_color text,
  allowed_email_domain text,
  reusable boolean
)
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
begin
  v_hash := encode(extensions.digest(convert_to(coalesce(p_token, ''), 'UTF8'), 'sha256'), 'hex');

  return query
  select
    o.name::text,
    i.email::text,
    i.expires_at,
    nullif(o.branding_settings->>'logoUrl', '')::text,
    nullif(o.branding_settings->>'primaryColor', '')::text,
    nullif(o.branding_settings->>'accentColor', '')::text,
    null::text,
    false
  from public.org_invites i
  join public.organizations o on o.id = i.org_id
  where i.status = 'pending'
    and i.expires_at > now()
    and (
      i.invite_token = p_token
      or i.invite_token_hash = v_hash
    )
  limit 1;

  if found then
    return;
  end if;

  return query
  select
    o.name::text,
    nullif(lower(trim(j.allowed_email)), '')::text,
    j.expires_at,
    nullif(o.branding_settings->>'logoUrl', '')::text,
    nullif(o.branding_settings->>'primaryColor', '')::text,
    nullif(o.branding_settings->>'accentColor', '')::text,
    nullif(lower(trim(j.allowed_email_domain)), '')::text,
    true
  from public.org_join_links j
  join public.organizations o on o.id = j.org_id
  where j.token_hash = v_hash
    and j.status = 'active'
    and j.expires_at > now()
    and (j.max_uses is null or j.use_count < j.max_uses)
  limit 1;
end;
$$;

revoke all on function public.get_invite_preview(text) from public;
grant execute on function public.get_invite_preview(text) to anon, authenticated;

alter function public.ensure_my_org(text, text)
  rename to ensure_my_org_email_invite;

create function public.ensure_my_org(
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
  v_email_confirmed_at timestamptz;
  v_token_hash text;
  v_link public.org_join_links%rowtype;
  v_existing_org_id uuid;
  v_existing_role text;
  v_inserted_use_count int := 0;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if nullif(trim(coalesce(p_invite_token, '')), '') is not null then
    v_token_hash := encode(
      extensions.digest(convert_to(p_invite_token, 'UTF8'), 'sha256'),
      'hex'
    );

    select j.*
      into v_link
    from public.org_join_links j
    where j.token_hash = v_token_hash
      and j.status = 'active'
      and j.expires_at > now()
      and (j.max_uses is null or j.use_count < j.max_uses)
    for update
    limit 1;

    if found then
      select lower(trim(u.email)), u.email_confirmed_at
        into v_email, v_email_confirmed_at
      from auth.users u
      where u.id = v_uid;

      if v_email_confirmed_at is null then
        raise exception 'Verify your email address before joining this organisation.';
      end if;

      if nullif(trim(coalesce(v_link.allowed_email, '')), '') is not null
        and v_email <> lower(trim(v_link.allowed_email)) then
        raise exception 'This organisation link is restricted to a different email address.';
      end if;

      if nullif(trim(coalesce(v_link.allowed_email_domain, '')), '') is not null
        and split_part(v_email, '@', 2) <> lower(trim(v_link.allowed_email_domain)) then
        raise exception 'Use your verified company email address to join this organisation.';
      end if;

      -- A user has one membership row. Serialize competing join attempts before
      -- inspecting it so a reusable link cannot silently move them between tenants.
      perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_uid::text, 0));

      select m.org_id, m.role
        into v_existing_org_id, v_existing_role
      from public.org_memberships m
      where m.user_id = v_uid
      for update;

      if found and v_existing_org_id <> v_link.org_id then
        raise exception
          'Your account already belongs to another organisation. Ask an administrator to transfer it.';
      end if;

      if v_existing_org_id is null then
        insert into public.org_memberships (user_id, org_id, role)
        values (v_uid, v_link.org_id, v_link.role);
      else
        -- Reusing a less-privileged link must never downgrade an existing member.
        update public.org_memberships
        set role = case
          when v_existing_role = 'admin' or v_link.role = 'admin' then 'admin'
          when v_existing_role = 'supervisor' or v_link.role = 'supervisor' then 'supervisor'
          else 'operative'
        end
        where user_id = v_uid;
      end if;

      insert into public.org_join_link_uses (link_id, user_id)
      values (v_link.id, v_uid)
      on conflict (link_id, user_id) do nothing;
      get diagnostics v_inserted_use_count = row_count;

      if v_inserted_use_count = 1 then
        update public.org_join_links
        set use_count = use_count + 1,
            updated_at = now()
        where id = v_link.id;
      end if;

      return query
      select
        o.slug::text,
        o.name::text,
        o.trial_ends_at,
        o.trial_extension_count,
        m.role::text,
        o.billing_plan::text,
        o.subscription_status::text
      from public.org_memberships m
      join public.organizations o on o.id = m.org_id
      where m.user_id = v_uid
      limit 1;
      return;
    end if;
  end if;

  return query
  select *
  from public.ensure_my_org_email_invite(p_org_name, p_invite_token);
end;
$$;

revoke all on function public.ensure_my_org(text, text) from public;
grant execute on function public.ensure_my_org(text, text) to authenticated;

comment on table public.org_join_links is
  'Reusable organisation enrolment links. Tokens are stored only as SHA-256 hashes.';
comment on function public.ensure_my_org(text, text) is
  'Accepts domain-restricted reusable org links, otherwise delegates to one-time email invites.';

do $$
declare
  v_org_id uuid;
  v_owner_id uuid;
begin
  select u.id
    into v_owner_id
  from public.platform_owner_email_allowlist a
  join auth.users u on lower(u.email) = lower(a.email)
  order by a.email
  limit 1;

  if v_owner_id is null then
    raise exception 'Cannot provision Barnes Fernández: no platform owner auth user found';
  end if;

  select o.id
    into v_org_id
  from public.organizations o
  where o.slug = 'barnes-fernandez'
  limit 1;

  if v_org_id is null then
    insert into public.organizations (slug, name, owner_user_id)
    values ('barnes-fernandez', 'Barnes Fernández', v_owner_id)
    returning id into v_org_id;
  end if;

  update public.organizations
  set
    name = 'Barnes Fernández',
    branding_settings = coalesce(branding_settings, '{}'::jsonb) || jsonb_build_object(
      'name', 'Barnes Fernández',
      'website', 'https://barnesfernandez.com/',
      'address', 'South of England, United Kingdom',
      'email', 'admin@barnesfernandez.com',
      'phone', '',
      'primaryColor', '#174F78',
      'accentColor', '#55B8D4',
      'pdfHeader', 'Barnes Fernández — Surveying & Civil Engineering',
      'pdfFooter', 'Barnes Fernández · barnesfernandez.com',
      'pdfTheme', 'executive',
      'pdfVersionPrefix', 'BF',
      'pdfComplianceLine', 'Controlled document. Ensure the latest approved revision is in use.',
      'industryPackId', 'surveyingGeodesy',
      'industrySectors', jsonb_build_array('construction'),
      'logoUrl', '/branding/barnes-fernandez-logo.png'
    ),
    branding_updated_at = now()
  where id = v_org_id;

  insert into public.org_join_links (
    org_id,
    name,
    token_hash,
    allowed_email_domain,
    role,
    expires_at,
    max_uses
  )
  values (
    v_org_id,
    'Barnes Fernández workers',
    'b6b24f1a917607e0ff05adc13d4cc239821a0e867c95f8f2a07a0f54ffc7f074',
    'barnesfernandez.com',
    'operative',
    '2028-07-31 23:59:59+00',
    500
  )
  on conflict (org_id, name) do update
    set token_hash = excluded.token_hash,
        allowed_email = null,
        allowed_email_domain = excluded.allowed_email_domain,
        role = excluded.role,
        status = 'active',
        expires_at = excluded.expires_at,
        max_uses = excluded.max_uses,
        updated_at = now();

  insert into public.org_join_links (
    org_id,
    name,
    token_hash,
    allowed_email,
    allowed_email_domain,
    role,
    expires_at,
    max_uses
  )
  values (
    v_org_id,
    'Barnes Fernández administrator',
    'd9db0ac889f86e9c91b52a7450c5b2f24261039938f4d59414c732baffc4009a',
    'admin@barnesfernandez.com',
    'barnesfernandez.com',
    'admin',
    '2026-10-31 23:59:59+00',
    1
  )
  on conflict (org_id, name) do update
    set token_hash = excluded.token_hash,
        allowed_email = excluded.allowed_email,
        allowed_email_domain = excluded.allowed_email_domain,
        role = excluded.role,
        status = 'active',
        expires_at = excluded.expires_at,
        max_uses = excluded.max_uses,
        updated_at = now();
end;
$$;
