-- Allow German country workspaces and de-DE document locale.

alter table public.org_country_workspaces
  drop constraint if exists org_country_workspaces_market_id_check;

alter table public.org_country_workspaces
  add constraint org_country_workspaces_market_id_check
  check (market_id in ('uk', 'pl', 'au', 'de'));

alter table public.org_country_workspaces
  drop constraint if exists org_country_workspaces_default_document_locale_check;

alter table public.org_country_workspaces
  add constraint org_country_workspaces_default_document_locale_check
  check (default_document_locale in ('en-GB', 'pl-PL', 'en-AU', 'de-DE'));

alter table public.org_document_language_preferences
  drop constraint if exists org_document_language_preferences_document_locale_check;

alter table public.org_document_language_preferences
  add constraint org_document_language_preferences_document_locale_check
  check (document_locale in ('en-GB', 'pl-PL', 'en-AU', 'de-DE'));

alter table public.org_document_language_preferences
  drop constraint if exists org_document_language_preferences_bilingual_secondary_locale_check;

alter table public.org_document_language_preferences
  add constraint org_document_language_preferences_bilingual_secondary_locale_check
  check (bilingual_secondary_locale is null or bilingual_secondary_locale in ('en-GB', 'pl-PL', 'en-AU', 'de-DE'));
