-- Seed Utility Mapping branding for the UM tenant (MySafeOps project).
-- Matches canonical slugs OR any org whose member signs in with @u-map.co.uk
-- (e.g. patryk@u-map.co.uk on auto-provisioned slug patryk-*).

update public.organizations o
set
  name = case
    when o.name is null
      or btrim(o.name) = ''
      or o.name ~* 'workspace$'
      or lower(o.name) in ('my organisation', 'my organization')
    then 'Utility Mapping'
    else o.name
  end,
  branding_settings = coalesce(o.branding_settings, '{}'::jsonb) || jsonb_build_object(
    'name', 'Utility Mapping',
    'website', coalesce(nullif(o.branding_settings->>'website', ''), 'https://u-map.co.uk/'),
    'address', coalesce(
      nullif(o.branding_settings->>'address', ''),
      E'6 Paynes Lane, 1st Floor, Rugby, CV21 2UH'
    ),
    'email', coalesce(nullif(o.branding_settings->>'email', ''), 'info@u-map.co.uk'),
    'phone', coalesce(nullif(o.branding_settings->>'phone', ''), '0800 024 UMAP'),
    'primaryColor', '#0B1D3A',
    'accentColor', '#00B4E4',
    'pdfHeader', coalesce(
      nullif(o.branding_settings->>'pdfHeader', ''),
      'Utility Mapping — PAS 128 Utility Survey Reports'
    ),
    'pdfFooter', coalesce(
      nullif(o.branding_settings->>'pdfFooter', ''),
      'Utility Mapping · u-map.co.uk · Part of IS GROUP'
    ),
    'pdfTheme', coalesce(nullif(o.branding_settings->>'pdfTheme', ''), 'executive'),
    'pdfVersionPrefix', coalesce(nullif(o.branding_settings->>'pdfVersionPrefix', ''), 'UM'),
    'pdfComplianceLine', coalesce(
      nullif(o.branding_settings->>'pdfComplianceLine', ''),
      'Controlled document. Ensure the latest approved revision is in use.'
    ),
    'industryPackId', 'utilityMapping',
    'industrySectors', coalesce(
      o.branding_settings->'industrySectors',
      jsonb_build_array('construction')
    ),
    'logoUrl', '/branding/utility-mapping-logo.png',
    'coverHeroUrl', '/branding/utility-mapping/cover-hero.jpg',
    'letterheadUrl', '/branding/utility-mapping/letterhead.jpg'
  ),
  branding_updated_at = now()
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
