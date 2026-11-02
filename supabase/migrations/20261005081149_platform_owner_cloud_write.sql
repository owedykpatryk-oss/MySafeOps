-- Platform owners already skip the client billing gate (billingAccess.js).
-- D1 mutating routes still call these RPCs. Re-assert the owner bypass on every
-- cloud write function the worker uses, including country-scoped KV keys, which
-- previously required a live paid country subscription and ignored
-- user_is_platform_owner(). Membership and role checks stay in place, so a
-- normal admin or member of an expired org is still blocked.

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
  -- Not a member: deny. Do not treat that as a billing exemption for other tenants.
  if not public.user_can_access_org_slug(p_org_slug) then
    return false;
  end if;
  -- Same JWT allowlist as Super Admin. Skip trial/subscription for this caller only.
  if public.user_is_platform_owner() then
    return true;
  end if;
  return public.org_allows_cloud_writes(p_org_slug);
end;
$$;

revoke all on function public.user_can_write_org_slug(text) from public;
grant execute on function public.user_can_write_org_slug(text) to authenticated;

comment on function public.user_can_write_org_slug(text) is
  'Membership + billing write gate for Cloudflare D1 mutating routes. Platform-owner members stay writable after trial expiry.';

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
  if not public.user_is_platform_owner()
     and not public.org_allows_cloud_writes(p_org_slug) then
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

revoke all on function public.user_can_write_org_kv(text, text) from public;
grant execute on function public.user_can_write_org_kv(text, text) to authenticated;

comment on function public.user_can_write_org_kv(text, text) is
  'D1 PUT /v1/kv — role+namespace rules. Platform owners skip the billing gate but not role rules.';

create or replace function public.user_can_delete_org_kv(p_org_slug text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.user_is_platform_owner()
     and not public.org_allows_cloud_writes(p_org_slug) then
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

revoke all on function public.user_can_delete_org_kv(text) from public;
grant execute on function public.user_can_delete_org_kv(text) to authenticated;

comment on function public.user_can_delete_org_kv(text) is
  'D1 DELETE /v1/kv — admin/supervisor. Platform owners skip the billing gate but not the role check.';

create or replace function public.user_can_write_org_country_kv(
  p_org_slug text,
  p_namespace text,
  p_data_key text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_workspace_id uuid;
  v_role text;
  v_status text;
  v_plan text;
  v_past_due_since timestamptz;
begin
  if p_data_key !~ '^country:[0-9a-fA-F-]{36}:' then
    return public.user_can_write_org_kv(p_org_slug, p_namespace);
  end if;
  begin
    v_workspace_id := split_part(p_data_key, ':', 2)::uuid;
  exception when invalid_text_representation then
    return false;
  end;

  select m.role, lower(coalesce(s.subscription_status, 'none')),
    lower(coalesce(s.billing_plan, '')), s.past_due_since
  into v_role, v_status, v_plan, v_past_due_since
  from public.organizations o
  join public.org_memberships m on m.org_id = o.id and m.user_id = auth.uid()
  join public.org_country_workspaces w on w.org_id = o.id and w.id = v_workspace_id and w.enabled
  join public.org_country_workspace_memberships wm on wm.workspace_id = w.id and wm.user_id = auth.uid()
  left join public.org_country_workspace_subscriptions s on s.workspace_id = w.id and s.stripe_mode = 'live'
  where o.slug = p_org_slug
  limit 1;

  if v_role is null then return false; end if;

  -- Paid country subscription is required for everyone except a platform owner
  -- who is already a member of this country workspace.
  if not public.user_is_platform_owner() then
    if not (
      (v_status in ('active', 'trialing') and v_plan in ('starter', 'team', 'business', 'enterprise', 'enterprise_plus'))
      or (v_status = 'past_due' and v_plan in ('starter', 'team', 'business', 'enterprise', 'enterprise_plus')
        and (v_past_due_since is null or now() < v_past_due_since + interval '7 days'))
    ) then
      return false;
    end if;
  end if;

  if v_role in ('admin', 'supervisor') then return true; end if;
  if v_role = 'operative' and p_namespace in (
    'mysafeops_workers', 'mysafeops_projects', 'training_matrix', 'cdm_packs', 'mysafeops_timesheets'
  ) then return false; end if;
  return v_role = 'operative';
end;
$$;

revoke all on function public.user_can_write_org_country_kv(text, text, text) from public, anon;
grant execute on function public.user_can_write_org_country_kv(text, text, text) to authenticated;

comment on function public.user_can_write_org_country_kv(text, text, text) is
  'D1 country KV writes. Non-country keys use user_can_write_org_kv. Country keys require country membership and, unless the caller is a platform owner, a live paid subscription.';
