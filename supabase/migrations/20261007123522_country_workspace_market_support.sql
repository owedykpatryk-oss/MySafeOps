-- Expand the RPCs as well as the table checks. Serialise creation per organisation
-- so its first country is always primary, including newly registered organisations.
create or replace function public.add_org_country_workspace(p_org_slug text, p_market_id text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_org_id uuid;
  v_workspace_id uuid;
  v_locale text;
  v_name text;
  v_primary boolean;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if p_market_id is null or p_market_id not in ('uk', 'pl', 'au', 'de', 'at', 'ch') then
    raise exception 'Unsupported market';
  end if;
  select o.id into v_org_id from public.organizations o
  join public.org_memberships m on m.org_id = o.id
  where o.slug = p_org_slug and m.user_id = v_uid and m.role = 'admin'
  for update of o;
  if v_org_id is null then raise exception 'Only organisation admins can add countries'; end if;
  v_locale := case p_market_id when 'pl' then 'pl-PL' when 'au' then 'en-AU'
    when 'de' then 'de-DE' when 'at' then 'de-AT' when 'ch' then 'de-CH' else 'en-GB' end;
  v_name := case p_market_id when 'pl' then 'Poland' when 'au' then 'Australia'
    when 'de' then 'Germany' when 'at' then 'Austria' when 'ch' then 'Switzerland' else 'United Kingdom' end;
  v_primary := not exists(select 1 from public.org_country_workspaces where org_id = v_org_id and is_primary);
  insert into public.org_country_workspaces
    (org_id, market_id, display_name, default_document_locale, is_primary, enabled, created_by)
  values (v_org_id, p_market_id, v_name, v_locale, v_primary, true, v_uid)
  returning id into v_workspace_id;
  insert into public.org_country_workspace_memberships(workspace_id, user_id, role)
  select v_workspace_id, m.user_id,
    case m.role when 'admin' then 'country_admin' when 'supervisor' then 'supervisor' else 'operative' end
  from public.org_memberships m where m.org_id = v_org_id
  on conflict (workspace_id, user_id) do nothing;
  insert into public.org_document_language_preferences(workspace_id, document_type, document_locale)
  select v_workspace_id, document_type, v_locale
  from unnest(array['rams', 'permit', 'survey', 'site_report']) as document_type
  on conflict (workspace_id, document_type) do nothing;
  return v_workspace_id;
exception when unique_violation then
  raise exception '% is already added to this organisation', v_name;
end;
$$;
revoke all on function public.add_org_country_workspace(text, text) from public, anon;
grant execute on function public.add_org_country_workspace(text, text) to authenticated;

create or replace function public.claim_legacy_country_workspace(p_org_slug text, p_market_id text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_org_id uuid;
  v_workspace public.org_country_workspaces%rowtype;
  v_workspace_id uuid;
  v_locale text;
  v_name text;
  v_currency text;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if p_market_id is null or p_market_id not in ('uk', 'pl', 'au', 'de', 'at', 'ch') then
    raise exception 'Unsupported market';
  end if;
  select o.id into v_org_id from public.organizations o
  join public.org_memberships m on m.org_id = o.id
  where o.slug = p_org_slug and m.user_id = v_uid and m.role = 'admin'
  for update of o;
  if v_org_id is null then raise exception 'Only organisation admins can claim a legacy country workspace'; end if;
  if not exists(select 1 from public.org_country_workspaces where org_id = v_org_id) then
    return public.add_org_country_workspace(p_org_slug, p_market_id);
  end if;
  select w.* into v_workspace from public.org_country_workspaces w
  where w.org_id = v_org_id and w.migration_source = 'legacy_organization' and w.is_primary
    and (select count(*) from public.org_country_workspaces x where x.org_id = v_org_id) = 1
  for update;
  if not found then
    select id into v_workspace_id from public.org_country_workspaces
    where org_id = v_org_id and market_id = p_market_id;
    return v_workspace_id;
  end if;
  if v_workspace.market_id <> p_market_id and exists (
    select 1 from public.org_country_workspace_subscriptions
    where workspace_id = v_workspace.id and (stripe_customer_id is not null or stripe_subscription_id is not null)
  ) then
    raise exception 'This country already has billing history. Add a separate country workspace instead.';
  end if;
  v_locale := case p_market_id when 'pl' then 'pl-PL' when 'au' then 'en-AU'
    when 'de' then 'de-DE' when 'at' then 'de-AT' when 'ch' then 'de-CH' else 'en-GB' end;
  v_name := case p_market_id when 'pl' then 'Poland' when 'au' then 'Australia'
    when 'de' then 'Germany' when 'at' then 'Austria' when 'ch' then 'Switzerland' else 'United Kingdom' end;
  v_currency := case p_market_id when 'pl' then 'PLN' when 'au' then 'AUD'
    when 'de' then 'EUR' when 'at' then 'EUR' when 'ch' then 'CHF' else 'GBP' end;
  update public.org_country_workspaces set market_id = p_market_id, display_name = v_name,
    default_document_locale = v_locale, migration_source = 'legacy_claimed' where id = v_workspace.id;
  update public.org_country_workspace_subscriptions set market_id = p_market_id, currency = v_currency
    where workspace_id = v_workspace.id;
  update public.org_document_language_preferences set document_locale = v_locale
    where workspace_id = v_workspace.id and document_locale = v_workspace.default_document_locale;
  return v_workspace.id;
end;
$$;
revoke all on function public.claim_legacy_country_workspace(text, text) from public, anon;
grant execute on function public.claim_legacy_country_workspace(text, text) to authenticated;

-- Earlier migrations added an explicit long constraint name but missed the
-- different name PostgreSQL generated for the original inline check.
alter table public.org_document_language_preferences
  drop constraint if exists org_document_language_preferen_bilingual_secondary_locale_check;
