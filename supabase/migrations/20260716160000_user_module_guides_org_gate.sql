-- Tighten user_module_guides RLS: require org membership for the org_slug,
-- matching org_permits / other tenant tables.

drop policy if exists "user_module_guides_select_own" on public.user_module_guides;
create policy "user_module_guides_select_own"
  on public.user_module_guides for select
  using (
    auth.uid() = user_id
    and public.user_can_access_org_slug(org_slug)
  );

drop policy if exists "user_module_guides_insert_own" on public.user_module_guides;
create policy "user_module_guides_insert_own"
  on public.user_module_guides for insert
  with check (
    auth.uid() = user_id
    and public.user_can_access_org_slug(org_slug)
  );

drop policy if exists "user_module_guides_update_own" on public.user_module_guides;
create policy "user_module_guides_update_own"
  on public.user_module_guides for update
  using (
    auth.uid() = user_id
    and public.user_can_access_org_slug(org_slug)
  )
  with check (
    auth.uid() = user_id
    and public.user_can_access_org_slug(org_slug)
  );

drop policy if exists "user_module_guides_delete_own" on public.user_module_guides;
create policy "user_module_guides_delete_own"
  on public.user_module_guides for delete
  using (
    auth.uid() = user_id
    and public.user_can_access_org_slug(org_slug)
  );
