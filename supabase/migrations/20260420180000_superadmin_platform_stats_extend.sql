-- Extends superadmin_platform_stats() with invite + subscription health metrics.
-- Replaces the function body; safe to run after 20260420160000_superadmin_platform_stats.sql

create or replace function public.superadmin_platform_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  v_now timestamptz := now();
  trend_jsonb jsonb;
  v_base jsonb;
  v_doc jsonb;
begin
  if v_email <> 'mysafeops@gmail.com' then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  trend_jsonb := (
    with months as (
      select generate_series(
        date_trunc('month', v_now) - interval '5 months',
        date_trunc('month', v_now),
        interval '1 month'
      ) as m
    ),
    counts as (
      select date_trunc('month', o.created_at) as m, count(*)::int as c
      from public.organizations o
      group by 1
    )
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'key', to_char(months.m, 'YYYY-MM'),
          'label', to_char(months.m, 'Mon YY'),
          'count', coalesce(counts.c, 0)
        )
        order by months.m
      ),
      '[]'::jsonb
    )
    from months
    left join counts on counts.m = months.m
  );

  v_base := jsonb_build_object(
    'ok', true,
    'fetched_at', to_char(v_now at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'total_organisations', (select count(*)::int from public.organizations),
    'organisations_30d', (
      select count(*)::int from public.organizations o
      where o.created_at >= v_now - interval '30 days'
    ),
    'total_memberships', (select count(*)::int from public.org_memberships),
    'new_memberships_7d', (
      select count(*)::int from public.org_memberships m
      where m.created_at >= v_now - interval '7 days'
    ),
    'orgs_with_stripe_customer', (
      select count(*)::int from public.organizations o
      where o.stripe_customer_id is not null and length(trim(o.stripe_customer_id)) > 0
    ),
    'paid_org_count', (
      select count(*)::int from public.organizations o
      where coalesce(lower(o.billing_plan), '') in ('starter', 'team', 'business')
        and coalesce(lower(o.subscription_status), '') in ('active', 'trialing')
    ),
    'trialing_org_count', (
      select count(*)::int from public.organizations o
      where coalesce(lower(o.subscription_status), '') = 'trialing'
    ),
    'past_due_or_unpaid_org_count', (
      select count(*)::int from public.organizations o
      where coalesce(lower(o.subscription_status), '') in ('past_due', 'unpaid')
    ),
    'orgs_with_zero_members', (
      select count(*)::int from public.organizations o
      where not exists (select 1 from public.org_memberships m where m.org_id = o.id)
    ),
    'pending_invites', (
      select count(*)::int from public.org_invites i
      where i.status = 'pending' and i.expires_at > v_now
    ),
    'subscriptions', coalesce(
      (
        select jsonb_object_agg(subscription_status, cnt)
        from (
          select o.subscription_status, count(*)::int as cnt
          from public.organizations o
          group by o.subscription_status
        ) s
      ),
      '{}'::jsonb
    ),
    'plans', coalesce(
      (
        select jsonb_object_agg(coalesce(billing_plan, 'none'), cnt)
        from (
          select o.billing_plan, count(*)::int as cnt
          from public.organizations o
          group by o.billing_plan
        ) p
      ),
      '{}'::jsonb
    )
  );

  v_doc :=
    v_base
    || jsonb_build_object(
      'registrations_trend',
      coalesce(trend_jsonb, '[]'::jsonb)
    );

  return v_doc;
end;
$$;

revoke all on function public.superadmin_platform_stats() from public;
grant execute on function public.superadmin_platform_stats() to authenticated;

comment on function public.superadmin_platform_stats is
  'Cross-tenant metrics for mysafeops@gmail.com only. Includes invites, trialing, billing risk, orphan orgs.';
