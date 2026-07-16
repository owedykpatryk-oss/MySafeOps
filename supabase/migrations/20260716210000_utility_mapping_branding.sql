-- Seed Utility Mapping branding when the organisation already exists (slug variants).
-- Client-side exclusive pack + navy/cyan covers are gated by isUtilityMappingOrg().

update public.organizations
set
  branding_settings = coalesce(branding_settings, '{}'::jsonb) || jsonb_build_object(
    'name', coalesce(nullif(branding_settings->>'name', ''), 'Utility Mapping'),
    'website', coalesce(nullif(branding_settings->>'website', ''), 'https://u-map.co.uk/'),
    'address', coalesce(
      nullif(branding_settings->>'address', ''),
      E'6 Paynes Lane, 1st Floor, Rugby, CV21 2UH'
    ),
    'email', coalesce(nullif(branding_settings->>'email', ''), 'info@u-map.co.uk'),
    'phone', coalesce(nullif(branding_settings->>'phone', ''), '0800 024 UMAP'),
    'primaryColor', coalesce(nullif(branding_settings->>'primaryColor', ''), '#0B1D3A'),
    'accentColor', coalesce(nullif(branding_settings->>'accentColor', ''), '#00B4E4'),
    'pdfHeader', coalesce(
      nullif(branding_settings->>'pdfHeader', ''),
      'Utility Mapping — PAS 128 Utility Survey Reports'
    ),
    'pdfFooter', coalesce(
      nullif(branding_settings->>'pdfFooter', ''),
      'Utility Mapping · u-map.co.uk · Part of IS GROUP'
    ),
    'pdfTheme', coalesce(nullif(branding_settings->>'pdfTheme', ''), 'executive'),
    'pdfVersionPrefix', coalesce(nullif(branding_settings->>'pdfVersionPrefix', ''), 'UM'),
    'pdfComplianceLine', coalesce(
      nullif(branding_settings->>'pdfComplianceLine', ''),
      'Controlled document. Ensure the latest approved revision is in use.'
    ),
    'industryPackId', coalesce(nullif(branding_settings->>'industryPackId', ''), 'utilityMapping'),
    'industrySectors', coalesce(
      branding_settings->'industrySectors',
      jsonb_build_array('construction')
    ),
    'logoUrl', '/branding/utility-mapping-logo.png',
    'coverHeroUrl', '/branding/utility-mapping/cover-hero.jpg',
    'letterheadUrl', '/branding/utility-mapping/letterhead.jpg'
  ),
  branding_updated_at = now()
where slug in (
  'utility-mapping',
  'utility_mapping',
  'u-map',
  'umap',
  'utility-mapping-group',
  'utility_mapping_group'
);
