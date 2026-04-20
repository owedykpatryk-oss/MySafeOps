-- Recent organisations list for platform owner (mysafeops@gmail.com) only.
-- Complements superadmin_platform_stats with actionable rows (support / billing triage).

create or replace function public.superadmin_recent_organisations(p_limit int default 50)
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
begin
  if v_email <> 'mysafeops@gmail.com' then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  return jsonb_build_object(
    'ok', true,
    'fetched_at', to_char(v_now at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'rows', coalesce(
      (
        select jsonb_agg(sub.obj)
        from (
          select jsonb_build_object(
            'id', o.id,
            'slug', o.slug,
            'name', o.name,
            'created_at', o.created_at,
            'subscription_status', coalesce(o.subscription_status, 'none'),
            'billing_plan', o.billing_plan,
            'has_stripe', (o.stripe_customer_id is not null and length(trim(coalesce(o.stripe_customer_id, ''))) > 0)
          ) as obj
          from public.organizations o
          order by o.created_at desc
          limit v_lim
        ) sub
      ),
      '[]'::jsonb
    )
  );
end;
$$;

revoke all on function public.superadmin_recent_organisations(int) from public;
grant execute on function public.superadmin_recent_organisations(int) to authenticated;

comment on function public.superadmin_recent_organisations is
  'Returns latest organisations (limited) for mysafeops@gmail.com only.';

-- Speeds up pending invite counts and future invite listings.
create index if not exists org_invites_pending_expires_idx
  on public.org_invites (expires_at desc)
  where status = 'pending';
