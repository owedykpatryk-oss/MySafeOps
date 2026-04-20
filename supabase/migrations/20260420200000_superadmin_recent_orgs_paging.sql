-- Pagination for superadmin_recent_organisations (owner dashboard "Load more").
-- Replaces single-argument overload with one function (p_limit, p_offset).

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
begin
  if v_email <> 'mysafeops@gmail.com' then
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

revoke all on function public.superadmin_recent_organisations(int, int) from public;
grant execute on function public.superadmin_recent_organisations(int, int) to authenticated;

comment on function public.superadmin_recent_organisations is
  'Latest organisations page for mysafeops@gmail.com only. p_limit max 100; returns has_more for UI paging.';
