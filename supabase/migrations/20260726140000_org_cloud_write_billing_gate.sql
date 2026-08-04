-- Server-side paywall for cloud sync + platform-owner probe (no email in client bundle).
-- D1 Worker should call user_can_write_org_slug for mutating routes; KV role RPCs also
-- enforce org_allows_cloud_writes so billing cannot be bypassed via namespace/role alone.

create or replace function public.user_is_platform_owner()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text;
  v_ok boolean;
begin
  v_email := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  if v_email = '' then
    return false;
  end if;
  select exists (
    select 1 from public.platform_owner_email_allowlist e where e.email = v_email
  ) into v_ok;
  return coalesce(v_ok, false);
end;
$$;

revoke all on function public.user_is_platform_owner() from public;
grant execute on function public.user_is_platform_owner() to authenticated;

comment on function public.user_is_platform_owner() is
  'True when JWT email is on platform_owner_email_allowlist. Client UI should call this instead of embedding owner emails.';

create or replace function public.org_allows_cloud_writes(p_org_slug text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_trial_ends timestamptz;
  v_status text;
  v_plan text;
  v_past_due_since timestamptz;
  v_paid boolean;
begin
  if public.user_is_platform_owner() then
    return true;
  end if;

  select
    o.trial_ends_at,
    lower(trim(coalesce(o.subscription_status, 'none'))),
    lower(trim(coalesce(o.billing_plan, ''))),
    o.subscription_past_due_since
  into v_trial_ends, v_status, v_plan, v_past_due_since
  from public.organizations o
  where o.slug = p_org_slug
  limit 1;

  if not found then
    return false;
  end if;

  v_paid := v_plan in ('starter', 'team', 'business', 'enterprise', 'enterprise_plus');

  if v_status in ('active', 'trialing') and v_paid then
    return true;
  end if;

  if v_status = 'past_due' and v_paid then
    if v_past_due_since is null then
      return true;
    end if;
    return now() < (v_past_due_since + interval '7 days');
  end if;

  if v_status in ('unpaid', 'canceled') then
    if v_trial_ends is not null and v_trial_ends > now() then
      return true;
    end if;
    if v_paid then
      return false;
    end if;
  end if;

  -- No trial row: do not lock legacy orgs (matches client local-only writable when trial unset).
  if v_trial_ends is null then
    return true;
  end if;

  return v_trial_ends > now();
end;
$$;

revoke all on function public.org_allows_cloud_writes(text) from public;
grant execute on function public.org_allows_cloud_writes(text) to authenticated;

comment on function public.org_allows_cloud_writes(text) is
  'True when org evaluation trial is active, paid subscription is writable (incl. past_due grace), or caller is platform owner.';

create or replace function public.user_can_write_org_slug(p_org_slug text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.user_can_access_org_slug(p_org_slug) then
    return false;
  end if;
  return public.org_allows_cloud_writes(p_org_slug);
end;
$$;

revoke all on function public.user_can_write_org_slug(text) from public;
grant execute on function public.user_can_write_org_slug(text) to authenticated;

comment on function public.user_can_write_org_slug(text) is
  'Membership + billing write gate for Cloudflare D1 mutating routes (PUT/DELETE/audit append).';

create or replace function public.user_can_write_org_kv(p_org_slug text, p_namespace text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text;
  v_ns text;
begin
  if not public.org_allows_cloud_writes(p_org_slug) then
    return false;
  end if;

  v_ns := trim(coalesce(p_namespace, ''));
  if char_length(v_ns) < 1 or char_length(v_ns) > 128 then
    return false;
  end if;
  if v_ns !~ '^[a-zA-Z0-9_.-]+$' then
    return false;
  end if;

  select m.role into v_role
  from public.org_memberships m
  join public.organizations o on o.id = m.org_id
  where m.user_id = auth.uid()
    and o.slug = p_org_slug
  limit 1;

  if v_role is null then
    return false;
  end if;

  if v_role in ('admin', 'supervisor') then
    return true;
  end if;

  if v_role = 'operative' and v_ns in (
    'mysafeops_workers',
    'mysafeops_projects',
    'training_matrix',
    'cdm_packs',
    'mysafeops_timesheets'
  ) then
    return false;
  end if;

  return v_role = 'operative';
end;
$$;

comment on function public.user_can_write_org_kv(text, text) is
  'D1 PUT /v1/kv — role+namespace rules and org billing write gate.';

create or replace function public.user_can_delete_org_kv(p_org_slug text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.org_allows_cloud_writes(p_org_slug) then
    return false;
  end if;
  return exists (
    select 1
    from public.org_memberships m
    join public.organizations o on o.id = m.org_id
    where m.user_id = auth.uid()
      and o.slug = p_org_slug
      and m.role in ('admin', 'supervisor')
  );
end;
$$;

comment on function public.user_can_delete_org_kv(text) is
  'D1 DELETE /v1/kv — admin/supervisor plus org billing write gate.';
