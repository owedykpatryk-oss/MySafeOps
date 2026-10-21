-- Explicit Data API grants for tables/views created by this repo's migrations.
-- Supabase change (enforced on existing projects from 2026-10-30): new tables in `public`
-- no longer get default grants for anon/authenticated/service_role.
-- https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically
--
-- Existing production tables keep their current grants, so on prod this migration is a
-- no-op that only codifies access. It matters for any database rebuilt from these
-- migrations (new project, branch, local) and documents intended access per role.
--
-- Rules used (generated from a static audit of supabase/migrations):
--  * service_role: select/insert/update/delete on every table, select on every view,
--    unless a migration already granted or revoked it explicitly.
--  * authenticated: only on tables with RLS enabled, and only the commands that have a
--    permissive policy for authenticated/public; views only if security_invoker.
--  * anon: only where a permissive policy explicitly targets anon.
--  * Tables/roles with an explicit GRANT or REVOKE in an earlier migration are left alone.
-- Idempotent: GRANT is a no-op when the privilege already exists; missing tables are skipped.

do $grants$
declare
  g record;
begin
  for g in
    select * from (values
      ('app_sync', 'service_role', 'select, insert, update, delete'),
      ('app_sync', 'authenticated', 'select, insert, update, delete'),
      ('client_portal_shares', 'service_role', 'select, insert, update, delete'),
      ('client_portal_shares', 'authenticated', 'select, insert, update, delete'),
      ('management_workspace_audit', 'service_role', 'select, insert, update, delete'),
      ('management_workspaces', 'service_role', 'select, insert, update, delete'),
      ('org_country_workspace_memberships', 'service_role', 'select, insert, update, delete'),
      ('org_country_workspace_subscriptions', 'service_role', 'select, insert, update, delete'),
      ('org_country_workspaces', 'service_role', 'select, insert, update, delete'),
      ('org_document_language_preferences', 'service_role', 'select, insert, update, delete'),
      ('org_invites', 'service_role', 'select, insert, update, delete'),
      ('org_invites', 'authenticated', 'select, insert, update, delete'),
      ('org_join_link_uses', 'service_role', 'select, insert, update, delete'),
      ('org_join_links', 'service_role', 'select, insert, update, delete'),
      ('org_memberships', 'service_role', 'select, insert, update, delete'),
      ('org_memberships', 'authenticated', 'select, insert, update, delete'),
      ('org_permit_audit', 'service_role', 'select, insert, update, delete'),
      ('org_permit_audit', 'authenticated', 'select, insert, update, delete'),
      ('org_permits', 'service_role', 'select, insert, update, delete'),
      ('org_permits', 'authenticated', 'select, insert, update, delete'),
      ('org_push_subscriptions', 'service_role', 'select, insert, update, delete'),
      ('org_push_subscriptions', 'authenticated', 'select, insert, update, delete'),
      ('org_user_preferences', 'service_role', 'select, insert, update, delete'),
      ('organizations', 'service_role', 'select, insert, update, delete'),
      ('organizations', 'authenticated', 'select, insert, update, delete'),
      ('permit_notification_log', 'service_role', 'select, insert, update, delete'),
      ('platform_owner_email_allowlist', 'service_role', 'select, insert, update, delete'),
      ('stripe_webhook_events', 'service_role', 'select, insert, update, delete'),
      ('stripe_webhook_failures', 'service_role', 'select, insert, update, delete'),
      ('user_module_guides', 'service_role', 'select, insert, update, delete'),
      ('user_module_guides', 'authenticated', 'select, insert, update, delete')
    ) as v(tbl, role_name, privs)
  loop
    if to_regclass(format('public.%I', g.tbl)) is null then
      raise notice 'skip grant on public.%: relation does not exist', g.tbl;
      continue;
    end if;
    execute format('grant %s on table public.%I to %I', g.privs, g.tbl, g.role_name);
  end loop;
end
$grants$;

-- Sequences behind serial/bigserial columns: inserts need USAGE on the sequence.
-- Granted to service_role always, and to authenticated only where it can insert.
do $seq$
declare
  s record;
begin
  for s in
    select seq.oid::regclass as seq_name, tbl.oid as tbl_oid
    from pg_class seq
    join pg_depend d on d.objid = seq.oid and d.deptype in ('a', 'i')
    join pg_class tbl on tbl.oid = d.refobjid
    join pg_namespace n on n.oid = tbl.relnamespace
    where seq.relkind = 'S' and n.nspname = 'public'
      and tbl.relname = any (array['management_workspace_audit', 'org_push_subscriptions', 'permit_notification_log', 'stripe_webhook_failures', 'user_module_guides']::text[])
  loop
    execute format('grant usage, select on sequence %s to service_role', s.seq_name);
    if has_table_privilege('authenticated', s.tbl_oid, 'INSERT') then
      execute format('grant usage, select on sequence %s to authenticated', s.seq_name);
    end if;
  end loop;
end
$seq$;

