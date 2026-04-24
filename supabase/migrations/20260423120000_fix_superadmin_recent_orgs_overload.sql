-- Resolves "function name superadmin_recent_organisations is not unique" (42725) when
-- multiple overloads exist and COMMENT/REPLACE is ambiguous. Drops all known signatures
-- and recreates the single canonical 2-argument version (platform owner allowlist).

create table if not exists public.platform_owner_email_allowlist (
  email text primary key
);
insert into public.platform_owner_email_allowlist (email) values ('mysafeops@gmail.com') on conflict (email) do nothing;

drop function if exists public.superadmin_recent_organisations(int);
drop function if exists public.superadmin_recent_organisations(int, int);

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

revoke all on function public.superadmin_recent_organisations(int, int) from public;
grant execute on function public.superadmin_recent_organisations(int, int) to authenticated;

comment on function public.superadmin_recent_organisations(int, int) is
  'Latest organisations page; JWT email must exist in platform_owner_email_allowlist. p_limit max 100.';

-- Idempotent: D1 Worker membership check
create or replace function public.user_can_access_org_slug(p_org_slug text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.org_memberships m
    join public.organizations o on o.id = m.org_id
    where m.user_id = auth.uid()
      and o.slug = p_org_slug
  );
$$;

grant execute on function public.user_can_access_org_slug(text) to authenticated;

comment on function public.user_can_access_org_slug(text) is
  'Returns true if the authenticated user is a member of the organisation with the given slug; used by Cloudflare D1 API Worker.';
