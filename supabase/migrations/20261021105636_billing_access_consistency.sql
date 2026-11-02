-- Scope extension to the selected organisation, require its administrator and
-- reject paid workspaces using the same runtime mode as checkout and write gates.
create function public.extend_org_trial(p_org_slug text)
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
  if b.subscription_status in ('active','trialing','past_due') and b.billing_plan is not null then
    raise exception 'An existing subscription cannot extend its evaluation trial';
  end if;
  if v_org.trial_extension_count >= 1 then raise exception 'Trial extension already used'; end if;
  return query update public.organizations o
    set trial_ends_at = greatest(o.trial_ends_at, now()) + interval '14 days',
        trial_extension_count = coalesce(o.trial_extension_count, 0) + 1
    where o.id = v_org.id
    returning o.slug, o.trial_ends_at, o.trial_extension_count;
end;
$$;
revoke all on function public.extend_org_trial(text) from public, anon;
grant execute on function public.extend_org_trial(text) to authenticated;

-- Older clients may omit the slug only when membership is unambiguous.
create or replace function public.extend_org_trial()
returns table(org_slug text, trial_ends_at timestamptz, trial_extension_count integer)
language plpgsql security invoker set search_path = '' as $$
declare v_slug text;
begin
  select min(o.slug) into v_slug from public.organizations o
  join public.org_memberships m on m.org_id = o.id
  where m.user_id = auth.uid() having count(*) = 1;
  if v_slug is null then raise exception 'Select an organisation to extend its trial'; end if;
  return query select * from public.extend_org_trial(v_slug);
end;
$$;

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
  end if;
  if b.subscription_status = 'past_due' then return false; end if;
  return coalesce(b.trial_ends_at > now(), false);
end;
$$;
create or replace function public.user_can_read_org_country_kv(p_org_slug text, p_data_key text)
returns boolean language sql stable security definer set search_path = '' as $$
  select case when p_data_key !~ '^country:[0-9a-fA-F-]{36}:' then public.user_can_access_org_slug(p_org_slug)
  else exists (
    select 1 from public.organizations o
    join public.org_memberships m on m.org_id = o.id and m.user_id = auth.uid()
    join public.org_country_workspaces w on w.org_id = o.id and w.enabled
    join public.org_country_workspace_memberships wm on wm.workspace_id = w.id and wm.user_id = auth.uid()
    where o.slug = p_org_slug and w.id::text = lower(split_part(p_data_key, ':', 2))
  ) end;
$$;
notify pgrst, 'reload schema';
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
  if public.user_is_platform_owner() then return true; end if;
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

