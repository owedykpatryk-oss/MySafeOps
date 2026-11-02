-- Checkout, UI entitlements and database write gates share one server-owned mode.
create table public.billing_runtime_config (
  singleton boolean primary key default true check (singleton),
  stripe_mode text not null check (stripe_mode in ('live', 'test'))
);
alter table public.billing_runtime_config enable row level security;
revoke all on public.billing_runtime_config from public, anon, authenticated;
grant select on public.billing_runtime_config to authenticated;
grant all on public.billing_runtime_config to service_role;
create policy billing_runtime_config_read on public.billing_runtime_config
  for select to authenticated using (true);
-- Match the existing checkout policy: real charges require explicit activation.
insert into public.billing_runtime_config (stripe_mode) values ('test');

create function public.get_billing_runtime_mode()
returns text language sql stable security invoker set search_path = '' as $$
  select stripe_mode from public.billing_runtime_config where singleton;
$$;
revoke all on function public.get_billing_runtime_mode() from public, anon;
grant execute on function public.get_billing_runtime_mode() to authenticated, service_role;

create or replace function public.get_my_country_workspace_entitlements(
  p_org_slug text, p_stripe_mode text default null
)
returns table(workspace_id uuid, stripe_mode text, market_id text, currency text,
  billing_plan text, subscription_status text, current_period_end timestamptz,
  cancel_at_period_end boolean, stripe_trial_end timestamptz, past_due_since timestamptz)
language sql stable security definer set search_path = '' as $$
  select s.workspace_id, s.stripe_mode, s.market_id, s.currency,
    s.billing_plan, s.subscription_status, s.current_period_end,
    s.cancel_at_period_end, s.stripe_trial_end, s.past_due_since
  from public.org_country_workspace_subscriptions s
  join public.org_country_workspaces w on w.id = s.workspace_id
  join public.organizations o on o.id = w.org_id
  where o.slug = p_org_slug
    and s.stripe_mode = coalesce(p_stripe_mode, public.get_billing_runtime_mode())
    and w.enabled
    and exists (select 1 from public.org_country_workspace_memberships wm
      where wm.workspace_id = w.id and wm.user_id = auth.uid())
    and exists (select 1 from public.org_memberships m
      where m.org_id = o.id and m.user_id = auth.uid());
$$;
revoke all on function public.get_my_country_workspace_entitlements(text, text) from public, anon;
grant execute on function public.get_my_country_workspace_entitlements(text, text) to authenticated, service_role;

-- Primary-country quotas must use the same source as country-scoped quotas.
create function public.get_my_org_billing(p_org_slug text)
returns table(billing_plan text, subscription_status text, trial_ends_at timestamptz,
  subscription_past_due_since timestamptz)
language sql stable security definer set search_path = '' as $$
  select
    case when s.workspace_id is null and public.get_billing_runtime_mode() = 'live' then o.billing_plan else s.billing_plan end,
    case when s.workspace_id is null and public.get_billing_runtime_mode() = 'live' then o.subscription_status else coalesce(s.subscription_status, 'none') end,
    o.trial_ends_at,
    case when s.workspace_id is null and public.get_billing_runtime_mode() = 'live' then o.subscription_past_due_since else s.past_due_since end
  from public.organizations o
  left join public.org_country_workspaces w on w.org_id = o.id and w.is_primary and w.enabled
  left join public.org_country_workspace_subscriptions s on s.workspace_id = w.id
    and s.stripe_mode = public.get_billing_runtime_mode()
  where o.slug = p_org_slug
    and exists (select 1 from public.org_memberships m where m.org_id = o.id and m.user_id = auth.uid())
    and (w.id is null or exists (select 1 from public.org_country_workspace_memberships wm
      where wm.workspace_id = w.id and wm.user_id = auth.uid()));
$$;
revoke all on function public.get_my_org_billing(text) from public, anon;
grant execute on function public.get_my_org_billing(text) to authenticated, service_role;

create or replace function public.org_allows_cloud_writes(p_org_slug text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare b record;
begin
  if public.user_is_platform_owner() then return true; end if;
  select * into b from public.get_my_org_billing(p_org_slug);
  if not found then return false; end if;
  if b.billing_plan in ('starter','team','business','enterprise','enterprise_plus') then
    if b.subscription_status in ('active','trialing') then return true; end if;
    if b.subscription_status = 'past_due' then
      return b.subscription_past_due_since is null or now() < b.subscription_past_due_since + interval '7 days';
    end if;
    if b.subscription_status in ('unpaid','canceled') then
      return coalesce(b.trial_ends_at > now(), false);
    end if;
  end if;
  return b.trial_ends_at is null or b.trial_ends_at > now();
end;
$$;

create or replace function public.user_can_write_org_country_kv(p_org_slug text, p_namespace text, p_data_key text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_workspace_id uuid; v_role text; v_status text; v_plan text; v_past_due_since timestamptz;
begin
  if p_data_key !~ '^country:[0-9a-fA-F-]{36}:' then
    return public.user_can_write_org_kv(p_org_slug, p_namespace);
  end if;
  begin
    v_workspace_id := split_part(p_data_key, ':', 2)::uuid;
  exception when invalid_text_representation then return false;
  end;
  select m.role, lower(coalesce(s.subscription_status,'none')), lower(coalesce(s.billing_plan,'')), s.past_due_since
  into v_role, v_status, v_plan, v_past_due_since
  from public.organizations o
  join public.org_memberships m on m.org_id = o.id and m.user_id = auth.uid()
  join public.org_country_workspaces w on w.org_id = o.id and w.id = v_workspace_id and w.enabled
  join public.org_country_workspace_memberships wm on wm.workspace_id = w.id and wm.user_id = auth.uid()
  left join public.org_country_workspace_subscriptions s on s.workspace_id = w.id
    and s.stripe_mode = public.get_billing_runtime_mode()
  where o.slug = p_org_slug limit 1;
  if v_role is null then return false; end if;
  if not (
    (v_status in ('active','trialing') and v_plan in ('starter','team','business','enterprise','enterprise_plus'))
    or (v_status = 'past_due' and v_plan in ('starter','team','business','enterprise','enterprise_plus')
      and (v_past_due_since is null or now() < v_past_due_since + interval '7 days'))
  ) then return false; end if;
  if v_role in ('admin','supervisor') then return true; end if;
  if v_role = 'operative' and p_namespace in ('mysafeops_workers','mysafeops_projects','training_matrix','cdm_packs','mysafeops_timesheets') then return false; end if;
  return v_role = 'operative';
end;
$$;
notify pgrst, 'reload schema';
