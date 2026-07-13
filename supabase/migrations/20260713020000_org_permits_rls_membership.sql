-- Tighten org_permits / org_permit_audit RLS: user must be org member (not only row owner).
-- Prevents writing PTW mirror rows for org slugs the signed-in user cannot access.

drop policy if exists "org_permits_select_own" on public.org_permits;
create policy "org_permits_select_member"
  on public.org_permits for select
  using (
    (select auth.uid()) = user_id
    and public.user_can_access_org_slug(org_slug)
  );

drop policy if exists "org_permits_insert_own" on public.org_permits;
create policy "org_permits_insert_member"
  on public.org_permits for insert
  with check (
    (select auth.uid()) = user_id
    and public.user_can_access_org_slug(org_slug)
  );

drop policy if exists "org_permits_update_own" on public.org_permits;
create policy "org_permits_update_member"
  on public.org_permits for update
  using (
    (select auth.uid()) = user_id
    and public.user_can_access_org_slug(org_slug)
  )
  with check (
    (select auth.uid()) = user_id
    and public.user_can_access_org_slug(org_slug)
  );

drop policy if exists "org_permits_delete_own" on public.org_permits;
create policy "org_permits_delete_member"
  on public.org_permits for delete
  using (
    (select auth.uid()) = user_id
    and public.user_can_access_org_slug(org_slug)
  );

drop policy if exists "org_permit_audit_select_own" on public.org_permit_audit;
create policy "org_permit_audit_select_member"
  on public.org_permit_audit for select
  using (
    (select auth.uid()) = user_id
    and public.user_can_access_org_slug(org_slug)
  );

drop policy if exists "org_permit_audit_insert_own" on public.org_permit_audit;
create policy "org_permit_audit_insert_member"
  on public.org_permit_audit for insert
  with check (
    (select auth.uid()) = user_id
    and public.user_can_access_org_slug(org_slug)
  );
