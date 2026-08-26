-- Complete the DACH rollout with Swiss workspaces and de-CH document output.
-- This intentionally replaces the previous DE/AT checks with the complete,
-- explicit market list so frontend and database validation cannot drift.

alter table public.org_country_workspaces
  drop constraint if exists org_country_workspaces_market_id_check;

alter table public.org_country_workspaces
  add constraint org_country_workspaces_market_id_check
  check (market_id in ('uk', 'pl', 'au', 'de', 'at', 'ch'));

alter table public.org_country_workspaces
  drop constraint if exists org_country_workspaces_default_document_locale_check;

alter table public.org_country_workspaces
  add constraint org_country_workspaces_default_document_locale_check
  check (default_document_locale in ('en-GB', 'pl-PL', 'en-AU', 'de-DE', 'de-AT', 'de-CH'));

alter table public.org_document_language_preferences
  drop constraint if exists org_document_language_preferences_document_locale_check;

alter table public.org_document_language_preferences
  add constraint org_document_language_preferences_document_locale_check
  check (document_locale in ('en-GB', 'pl-PL', 'en-AU', 'de-DE', 'de-AT', 'de-CH'));

alter table public.org_document_language_preferences
  drop constraint if exists org_document_language_preferences_bilingual_secondary_locale_check;

alter table public.org_document_language_preferences
  add constraint org_document_language_preferences_bilingual_secondary_locale_check
  check (
    bilingual_secondary_locale is null
    or bilingual_secondary_locale in ('en-GB', 'pl-PL', 'en-AU', 'de-DE', 'de-AT', 'de-CH')
  );
