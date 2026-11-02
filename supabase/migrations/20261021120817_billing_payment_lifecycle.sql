-- One paid-access predicate for primary and additional countries. Unknown grace
-- dates must not become unlimited credit, and scheduled cancellation has an end.
create or replace function public.billing_subscription_allows_writes(
  p_status text, p_plan text, p_past_due_since timestamptz,
  p_cancel_at_period_end boolean, p_current_period_end timestamptz)
returns boolean language sql stable security invoker set search_path = '' as $$
  select coalesce(
    p_plan in ('starter','team','business','enterprise','enterprise_plus')
    and (not coalesce(p_cancel_at_period_end, false) or now() < p_current_period_end)
    and (p_status in ('active','trialing') or (p_status = 'past_due'
      and p_past_due_since is not null and now() < p_past_due_since + interval '7 days')),
    false);
$$;
revoke all on function public.billing_subscription_allows_writes(text,text,timestamptz,boolean,timestamptz) from public, anon;
grant execute on function public.billing_subscription_allows_writes(text,text,timestamptz,boolean,timestamptz) to authenticated, service_role;

create or replace function public.org_allows_cloud_writes(p_org_slug text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare b record; v_cancel boolean; v_end timestamptz;
begin
  if public.user_is_platform_owner() then return true; end if;
  select * into b from public.get_my_org_billing(p_org_slug);
  if not found then return false; end if;
  select case when s.workspace_id is null and public.get_billing_runtime_mode() = 'live'
      then o.stripe_cancel_at_period_end else s.cancel_at_period_end end,
    case when s.workspace_id is null and public.get_billing_runtime_mode() = 'live'
      then o.stripe_current_period_end else s.current_period_end end
  into v_cancel, v_end
  from public.organizations o
  left join public.org_country_workspaces w on w.org_id = o.id and w.is_primary
  left join public.org_country_workspace_subscriptions s on s.workspace_id = w.id
    and s.stripe_mode = public.get_billing_runtime_mode()
  where o.slug = p_org_slug;
  if public.billing_subscription_allows_writes(b.subscription_status, b.billing_plan,
      b.subscription_past_due_since, v_cancel, v_end) then return true; end if;
  if coalesce(b.subscription_status, 'none') <> 'none' then return false; end if;
  return coalesce(b.trial_ends_at > now(), false);
end;
$$;

create or replace function public.user_can_write_org_country_kv(p_org_slug text, p_namespace text, p_data_key text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_workspace_id uuid; v_role text; v_status text; v_plan text;
  v_past_due_since timestamptz; v_cancel boolean; v_end timestamptz;
begin
  if p_data_key !~ '^country:[0-9a-fA-F-]{36}:' then return public.user_can_write_org_kv(p_org_slug, p_namespace); end if;
  begin v_workspace_id := split_part(p_data_key, ':', 2)::uuid;
  exception when invalid_text_representation then return false; end;
  select m.role, lower(coalesce(s.subscription_status,'none')), lower(coalesce(s.billing_plan,'')),
    s.past_due_since, s.cancel_at_period_end, s.current_period_end
  into v_role, v_status, v_plan, v_past_due_since, v_cancel, v_end
  from public.organizations o
  join public.org_memberships m on m.org_id = o.id and m.user_id = auth.uid()
  join public.org_country_workspaces w on w.org_id = o.id and w.id = v_workspace_id and w.enabled
  join public.org_country_workspace_memberships wm on wm.workspace_id = w.id and wm.user_id = auth.uid()
  left join public.org_country_workspace_subscriptions s on s.workspace_id = w.id
    and s.stripe_mode = public.get_billing_runtime_mode()
  where o.slug = p_org_slug limit 1;
  if v_role is null then return false; end if;
  if public.user_is_platform_owner() then return true; end if;
  if not public.billing_subscription_allows_writes(v_status, v_plan, v_past_due_since, v_cancel, v_end) then return false; end if;
  if v_role in ('admin','supervisor') then return true; end if;
  if v_role = 'operative' and p_namespace in ('mysafeops_workers','mysafeops_projects','training_matrix','cdm_packs','mysafeops_timesheets') then return false; end if;
  return v_role = 'operative';
end;
$$;

create or replace function public.extend_org_trial(p_org_slug text)
returns table(org_slug text, trial_ends_at timestamptz, trial_extension_count integer)
language plpgsql security definer set search_path = '' as $$
declare v_org public.organizations%rowtype; b record;
begin
  select o.* into v_org from public.organizations o
  join public.org_memberships m on m.org_id = o.id
  where o.slug = p_org_slug and m.user_id = auth.uid() and m.role = 'admin'
  for update of o;
  if not found then raise exception 'Organisation administrator required'; end if;
  select * into b from public.get_my_org_billing(p_org_slug);
  if not found then raise exception 'Workspace membership required'; end if;
  if coalesce(b.subscription_status, 'none') <> 'none' then
    raise exception 'An existing or ended subscription cannot extend its evaluation trial';
  end if;
  if v_org.trial_extension_count >= 1 then raise exception 'Trial extension already used'; end if;
  return query update public.organizations o
    set trial_ends_at = greatest(o.trial_ends_at, now()) + interval '14 days',
        trial_extension_count = coalesce(o.trial_extension_count, 0) + 1
    where o.id = v_org.id returning o.slug, o.trial_ends_at, o.trial_extension_count;
end;
$$;
notify pgrst, 'reload schema';
