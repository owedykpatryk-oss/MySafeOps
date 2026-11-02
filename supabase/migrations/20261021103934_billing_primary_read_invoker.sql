-- Reuse the membership-filtered entitlement RPC without adding a privileged public reader.
create or replace function public.get_my_org_billing(p_org_slug text)
returns table(billing_plan text, subscription_status text, trial_ends_at timestamptz,
  subscription_past_due_since timestamptz)
language sql stable security invoker set search_path = '' as $$
  select
    case when s.workspace_id is null and public.get_billing_runtime_mode() = 'live' then o.billing_plan else s.billing_plan end,
    case when s.workspace_id is null and public.get_billing_runtime_mode() = 'live' then o.subscription_status else coalesce(s.subscription_status, 'none') end,
    o.trial_ends_at,
    case when s.workspace_id is null and public.get_billing_runtime_mode() = 'live' then o.subscription_past_due_since else s.past_due_since end
  from public.organizations o
  left join public.org_country_workspaces w on w.org_id = o.id and w.is_primary and w.enabled
  left join public.get_my_country_workspace_entitlements(p_org_slug) s on s.workspace_id = w.id
  where o.slug = p_org_slug
    and exists (select 1 from public.org_memberships m where m.org_id = o.id and m.user_id = auth.uid())
    and (w.id is null or exists (select 1 from public.org_country_workspace_memberships wm
      where wm.workspace_id = w.id and wm.user_id = auth.uid()));
$$;
notify pgrst, 'reload schema';
