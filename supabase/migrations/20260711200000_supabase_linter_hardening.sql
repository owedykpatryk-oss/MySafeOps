-- Supabase database linter hardening (security + RLS performance).
-- Resolves: function_search_path_mutable, anon EXECUTE on SECURITY DEFINER RPCs,
-- rls_enabled_no_policy (deny-direct-access), auth_rls_initplan, unindexed foreign keys.
--
-- Intentional remaining warnings:
--   - get_invite_preview / fetch_client_portal_share: anon + SECURITY DEFINER (token-gated public flows).
--   - authenticated + SECURITY DEFINER on org RPCs (PostgREST pattern; functions enforce auth.uid()).
--   - auth_leaked_password_protection: enable in Dashboard → Auth → Password security.

-- ---------------------------------------------------------------------------
-- 1) search_path on trigger/helper functions
-- ---------------------------------------------------------------------------

create or replace function public.touch_org_push_subscriptions_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_fess_reserved_email(p_email text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select lower(trim(coalesce(p_email, ''))) in (
    'jack@fessgroup.co.uk',
    'maciej@fessgroup.co.uk'
  );
$$;

-- ---------------------------------------------------------------------------
-- 2) Revoke anon/PUBLIC EXECUTE on SECURITY DEFINER RPCs (keep authenticated)
--    Public token RPCs: get_invite_preview, fetch_client_portal_share
-- ---------------------------------------------------------------------------

do $revoke$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.proname not in ('get_invite_preview', 'fetch_client_portal_share')
  loop
    execute format('revoke all on function %s from public', r.sig);
    execute format('revoke all on function %s from anon', r.sig);
  end loop;
end;
$revoke$;

-- Trigger-only guards — not callable via PostgREST
revoke all on function public.guard_fess_org_membership() from public, anon, authenticated;
revoke all on function public.guard_fess_org_invites() from public, anon, authenticated;

-- Re-grant authenticated EXECUTE on app RPCs (idempotent)
grant execute on function public.ensure_my_org(text, text) to authenticated;
grant execute on function public.extend_org_trial() to authenticated;
grant execute on function public.get_my_membership_role(text) to authenticated;
grant execute on function public.get_my_org_branding() to authenticated;
grant execute on function public.list_org_members() to authenticated;
grant execute on function public.remove_org_member(uuid) to authenticated;
grant execute on function public.update_my_org_branding(jsonb) to authenticated;
grant execute on function public.update_org_member_role(uuid, text) to authenticated;
grant execute on function public.user_can_access_org_slug(text) to authenticated;
grant execute on function public.user_can_delete_org_kv(text) to authenticated;
grant execute on function public.user_can_read_org_audit(text) to authenticated;
grant execute on function public.user_can_write_org_kv(text, text) to authenticated;
grant execute on function public.is_fess_reserved_email(text) to authenticated;
grant execute on function public.superadmin_platform_stats() to authenticated;
grant execute on function public.superadmin_provision_org_members(text, text, text[], text) to authenticated;
grant execute on function public.superadmin_recent_organisations(int, int) to authenticated;

-- Public token flows (anon + authenticated)
revoke all on function public.get_invite_preview(text) from public;
grant execute on function public.get_invite_preview(text) to anon, authenticated;

revoke all on function public.fetch_client_portal_share(text) from public;
grant execute on function public.fetch_client_portal_share(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3) RLS: explicit deny policies on allowlist / legacy sync tables (no direct API reads)
-- ---------------------------------------------------------------------------

drop policy if exists "platform_owner_email_allowlist_deny_api" on public.platform_owner_email_allowlist;
create policy "platform_owner_email_allowlist_deny_api"
  on public.platform_owner_email_allowlist
  for all
  to anon, authenticated
  using (false)
  with check (false);

do $org_sync$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'org_sync_kv'
      and c.relkind = 'r'
  ) then
    execute 'drop policy if exists "org_sync_kv_deny_api" on public.org_sync_kv';
    execute '
      create policy "org_sync_kv_deny_api"
        on public.org_sync_kv
        for all
        to anon, authenticated
        using (false)
        with check (false)
    ';
  end if;
end;
$org_sync$;

-- ---------------------------------------------------------------------------
-- 4) RLS initplan: (select auth.uid()) avoids per-row re-evaluation
-- ---------------------------------------------------------------------------

drop policy if exists "app_sync_select_own" on public.app_sync;
create policy "app_sync_select_own"
  on public.app_sync for select
  using ((select auth.uid()) = user_id);

drop policy if exists "app_sync_insert_own" on public.app_sync;
create policy "app_sync_insert_own"
  on public.app_sync for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists "app_sync_update_own" on public.app_sync;
create policy "app_sync_update_own"
  on public.app_sync for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "app_sync_delete_own" on public.app_sync;
create policy "app_sync_delete_own"
  on public.app_sync for delete
  using ((select auth.uid()) = user_id);

drop policy if exists "organizations_select_member" on public.organizations;
create policy "organizations_select_member"
  on public.organizations for select
  using (
    exists (
      select 1
      from public.org_memberships m
      where m.org_id = organizations.id
        and m.user_id = (select auth.uid())
    )
  );

drop policy if exists "org_memberships_select_own" on public.org_memberships;
create policy "org_memberships_select_own"
  on public.org_memberships for select
  using (user_id = (select auth.uid()));

drop policy if exists "org_invites_select_org_members" on public.org_invites;
create policy "org_invites_select_org_members"
  on public.org_invites for select
  using (
    exists (
      select 1
      from public.org_memberships m
      where m.org_id = org_invites.org_id
        and m.user_id = (select auth.uid())
    )
  );

drop policy if exists "org_invites_insert_org_admin" on public.org_invites;
create policy "org_invites_insert_org_admin"
  on public.org_invites for insert
  with check (
    exists (
      select 1
      from public.org_memberships m
      where m.org_id = org_invites.org_id
        and m.user_id = (select auth.uid())
        and m.role = 'admin'
    )
  );

drop policy if exists "org_invites_update_org_admin" on public.org_invites;
create policy "org_invites_update_org_admin"
  on public.org_invites for update
  using (
    exists (
      select 1
      from public.org_memberships m
      where m.org_id = org_invites.org_id
        and m.user_id = (select auth.uid())
        and m.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.org_memberships m
      where m.org_id = org_invites.org_id
        and m.user_id = (select auth.uid())
        and m.role = 'admin'
    )
  );

drop policy if exists "org_push_subscriptions_select_own" on public.org_push_subscriptions;
create policy "org_push_subscriptions_select_own"
  on public.org_push_subscriptions for select
  using ((select auth.uid()) = user_id);

drop policy if exists "org_push_subscriptions_insert_own" on public.org_push_subscriptions;
create policy "org_push_subscriptions_insert_own"
  on public.org_push_subscriptions for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists "org_push_subscriptions_update_own" on public.org_push_subscriptions;
create policy "org_push_subscriptions_update_own"
  on public.org_push_subscriptions for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "org_push_subscriptions_delete_own" on public.org_push_subscriptions;
create policy "org_push_subscriptions_delete_own"
  on public.org_push_subscriptions for delete
  using ((select auth.uid()) = user_id);

drop policy if exists "org_permits_select_own" on public.org_permits;
create policy "org_permits_select_own"
  on public.org_permits for select
  using ((select auth.uid()) = user_id);

drop policy if exists "org_permits_insert_own" on public.org_permits;
create policy "org_permits_insert_own"
  on public.org_permits for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists "org_permits_update_own" on public.org_permits;
create policy "org_permits_update_own"
  on public.org_permits for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "org_permits_delete_own" on public.org_permits;
create policy "org_permits_delete_own"
  on public.org_permits for delete
  using ((select auth.uid()) = user_id);

drop policy if exists "org_permit_audit_select_own" on public.org_permit_audit;
create policy "org_permit_audit_select_own"
  on public.org_permit_audit for select
  using ((select auth.uid()) = user_id);

drop policy if exists "org_permit_audit_insert_own" on public.org_permit_audit;
create policy "org_permit_audit_insert_own"
  on public.org_permit_audit for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists "client_portal_shares_owner_all" on public.client_portal_shares;
create policy "client_portal_shares_owner_all"
  on public.client_portal_shares
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- 5) Foreign key covering indexes
-- ---------------------------------------------------------------------------

create index if not exists org_invites_accepted_user_id_idx
  on public.org_invites (accepted_user_id);

create index if not exists org_invites_invited_by_idx
  on public.org_invites (invited_by);

create index if not exists organizations_owner_user_id_idx
  on public.organizations (owner_user_id);
