-- Superadmin RPCs: allow any email in `platform_owner_email_allowlist` (not only a hardcoded address).
-- Keep in sync with app config: add rows to match `VITE_PLATFORM_OWNER_EMAIL` (or legacy owner).

create table if not exists public.platform_owner_email_allowlist (
  email text primary key
);

insert into public.platform_owner_email_allowlist (email) values ('mysafeops@gmail.com') on conflict (email) do nothing;

revoke all on public.platform_owner_email_allowlist from public;
revoke all on public.platform_owner_email_allowlist from anon, authenticated;
alter table public.platform_owner_email_allowlist enable row level security;
-- No SELECT policy for API roles — only SECURITY DEFINER functions below read this table.

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

-- Only one public.superadmin_recent_organisations (2-arg) must exist: drop 1-arg overload.
drop function if exists public.superadmin_recent_organisations(int);

create or replace function public.superadmin_recent_organisations(p_limit int default 50, p_offset int default 0)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  v_now timestamptz := now();
  v_lim int := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_off int := greatest(coalesce(p_offset, 0), 0);
  v_rows jsonb;
  v_has_more boolean;
  v_ok boolean;
begin
  select exists (select 1 from public.platform_owner_email_allowlist e where e.email = v_email) into v_ok;
  if v_email = '' or v_ok is not true then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  select coalesce(jsonb_agg(obj order by oc desc), '[]'::jsonb)
  into v_rows
  from (
    select
      jsonb_build_object(
        'id', o.id,
        'slug', o.slug,
        'name', o.name,
        'created_at', o.created_at,
        'subscription_status', coalesce(o.subscription_status, 'none'),
        'billing_plan', o.billing_plan,
        'has_stripe', (o.stripe_customer_id is not null and length(trim(coalesce(o.stripe_customer_id, ''))) > 0)
      ) as obj,
      o.created_at as oc
    from public.organizations o
    order by o.created_at desc
    limit v_lim
    offset v_off
  ) sub;

  select exists (
    select 1
    from public.organizations o2
    order by o2.created_at desc
    offset v_off + v_lim
    limit 1
  )
  into v_has_more;

  return jsonb_build_object(
    'ok', true,
    'fetched_at', to_char(v_now at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'offset', v_off,
    'limit', v_lim,
    'has_more', coalesce(v_has_more, false),
    'rows', coalesce(v_rows, '[]'::jsonb)
  );
end;
$$;

revoke all on function public.superadmin_platform_stats() from public;
grant execute on function public.superadmin_platform_stats() to authenticated;

revoke all on function public.superadmin_recent_organisations(int, int) from public;
grant execute on function public.superadmin_recent_organisations(int, int) to authenticated;

comment on table public.platform_owner_email_allowlist is
  'JWT email allow-list for superadmin RPCs. Add rows in SQL Editor to match VITE_PLATFORM_OWNER_EMAIL.';

comment on function public.superadmin_platform_stats is
  'Cross-tenant platform metrics; JWT email must exist in platform_owner_email_allowlist.';

comment on function public.superadmin_recent_organisations(int, int) is
  'Latest organisations page; JWT email must exist in platform_owner_email_allowlist. p_limit max 100.';
