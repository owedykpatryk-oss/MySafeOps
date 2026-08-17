-- Platform-owner courtesy trial extension for Utility Mapping (MySafeOps).
-- Sets trial_ends_at to now() + 14 days without consuming trial_extension_count.
-- Also adds superadmin_extend_org_trial so later courtesy extensions do not need a new migration.

create or replace function public.superadmin_extend_org_trial(p_org_slug text, p_days int default 14)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_days int := least(greatest(coalesce(p_days, 14), 1), 90);
  v_slug text := lower(trim(coalesce(p_org_slug, '')));
  v_out_slug text;
  v_ends timestamptz;
begin
  if not public.user_is_platform_owner() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  if v_slug = '' then
    return jsonb_build_object('ok', false, 'error', 'missing_slug');
  end if;

  update public.organizations o
  set trial_ends_at = now() + (v_days * interval '1 day')
  where lower(replace(o.slug, '_', '-')) = replace(v_slug, '_', '-')
  returning o.slug, o.trial_ends_at
    into v_out_slug, v_ends;

  if v_out_slug is null then
    return jsonb_build_object('ok', false, 'error', 'organisation_not_found');
  end if;

  return jsonb_build_object(
    'ok', true,
    'org_slug', v_out_slug,
    'trial_ends_at', v_ends,
    'days', v_days
  );
end;
$$;

revoke all on function public.superadmin_extend_org_trial(text, int) from public;
grant execute on function public.superadmin_extend_org_trial(text, int) to authenticated;

comment on function public.superadmin_extend_org_trial(text, int) is
  'Platform owner only: set an organisation trial_ends_at to now() + p_days (1–90). Does not consume trial_extension_count.';

-- Courtesy +14 days from apply time for Utility Mapping tenants (canonical slugs or @u-map.co.uk members).
update public.organizations o
set trial_ends_at = now() + interval '14 days'
where
  lower(replace(o.slug, '_', '-')) in (
    'utility-mapping',
    'u-map',
    'umap',
    'utility-mapping-group'
  )
  or exists (
    select 1
    from public.org_memberships m
    join auth.users u on u.id = m.user_id
    where m.org_id = o.id
      and lower(u.email) like '%@u-map.co.uk'
  );
