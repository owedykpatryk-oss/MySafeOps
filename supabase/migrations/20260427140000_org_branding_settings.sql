-- Organisation branding (PDF/logo/colours) — shared across members via Supabase.

alter table public.organizations
  add column if not exists branding_settings jsonb,
  add column if not exists branding_updated_at timestamptz;

comment on column public.organizations.branding_settings is
  'Shared org branding for PDFs/exports (logo may be data URL or logoUrl path).';
comment on column public.organizations.branding_updated_at is
  'Last admin write to branding_settings; clients compare with local cache.';

-- Seed FESS Group branding once (logo fetched client-side from logoUrl).
update public.organizations
set
  branding_settings = jsonb_build_object(
    'name', 'FESS Group',
    'website', 'https://pl.fessgroup.co.uk/',
    'address', E'FESS Group\nUnited Kingdom',
    'phone', '',
    'email', '',
    'primaryColor', '#f97316',
    'accentColor', '#0f172a',
    'pdfHeader', 'FESS Group — Health & Safety Documentation',
    'pdfFooter', 'FESS Group · mysafeops.com',
    'pdfTheme', 'executive',
    'pdfVersionPrefix', 'FESS',
    'pdfWatermarkText', '',
    'pdfComplianceLine', 'Controlled document. Ensure latest approved revision is in use.',
    'defaultLeadEngineer', '',
    'industrySectors', jsonb_build_array(
      'construction', 'food_beverage', 'pet_food', 'pharma', 'petrochem'
    ),
    'logoUrl', '/branding/fess-group-logo.png'
  ),
  branding_updated_at = now()
where slug = 'fess-group'
  and (branding_settings is null or branding_settings = '{}'::jsonb);

create or replace function public.get_my_org_branding()
returns table (
  settings jsonb,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  return query
  select o.branding_settings, o.branding_updated_at
  from public.org_memberships m
  join public.organizations o on o.id = m.org_id
  where m.user_id = v_uid
  limit 1;
end;
$$;

create or replace function public.update_my_org_branding(p_settings jsonb)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org_id uuid;
  v_role text;
  v_at timestamptz := now();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if p_settings is null or p_settings = '{}'::jsonb then
    raise exception 'Branding settings required';
  end if;

  select m.org_id, m.role
    into v_org_id, v_role
  from public.org_memberships m
  where m.user_id = v_uid
  limit 1;

  if v_org_id is null then
    raise exception 'No organisation membership';
  end if;
  if v_role <> 'admin' then
    raise exception 'Only organisation admins can update branding';
  end if;

  update public.organizations o
  set branding_settings = p_settings,
      branding_updated_at = v_at
  where o.id = v_org_id;

  return v_at;
end;
$$;

grant execute on function public.get_my_org_branding() to authenticated;
grant execute on function public.update_my_org_branding(jsonb) to authenticated;

comment on function public.get_my_org_branding() is
  'Returns shared branding JSON for the signed-in user''s organisation.';
comment on function public.update_my_org_branding(jsonb) is
  'Admin-only: writes shared branding for the signed-in user''s organisation.';
