-- Allow Enterprise (Stripe) and Enterprise Plus (manual / sales) on organisations.billing_plan.
-- Aligns with src/lib/billingPlans.js STRIPE_SUBSCRIBABLE_PLAN_IDS + enterprise_plus.

alter table public.organizations drop constraint if exists organizations_billing_plan_check;

alter table public.organizations
  add constraint organizations_billing_plan_check
  check (
    billing_plan is null
    or billing_plan in ('starter', 'team', 'business', 'enterprise', 'enterprise_plus')
  );

comment on column public.organizations.billing_plan is
  'Paid tier when subscription is active: starter | team | business | enterprise; enterprise_plus = custom contract (set manually, not Stripe checkout).';

-- Refresh superadmin metrics: paid_org_count includes enterprise subscriptions.
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
  v_ok boolean;
begin
  select exists (select 1 from public.platform_owner_email_allowlist e where e.email = v_email) into v_ok;
  if v_email = '' or v_ok is not true then
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
      where coalesce(lower(o.billing_plan), '') in ('starter', 'team', 'business', 'enterprise')
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
  'Cross-tenant platform metrics; JWT email must exist in platform_owner_email_allowlist.';
