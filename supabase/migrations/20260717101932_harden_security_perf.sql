-- Harden Auth-related DB surface + RLS performance (Jul 2026).
-- 1) Fix mutable search_path on trigger function
-- 2) Wrap auth.uid() in (select ...) for initplan
-- 3) Re-assert claim_edge_rate_bucket is service_role only (advisor still saw anon)

create or replace function public.touch_user_module_guides_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop policy if exists "user_module_guides_select_own" on public.user_module_guides;
create policy "user_module_guides_select_own"
  on public.user_module_guides for select
  using (
    (select auth.uid()) = user_id
    and public.user_can_access_org_slug(org_slug)
  );

drop policy if exists "user_module_guides_insert_own" on public.user_module_guides;
create policy "user_module_guides_insert_own"
  on public.user_module_guides for insert
  with check (
    (select auth.uid()) = user_id
    and public.user_can_access_org_slug(org_slug)
  );

drop policy if exists "user_module_guides_update_own" on public.user_module_guides;
create policy "user_module_guides_update_own"
  on public.user_module_guides for update
  using (
    (select auth.uid()) = user_id
    and public.user_can_access_org_slug(org_slug)
  )
  with check (
    (select auth.uid()) = user_id
    and public.user_can_access_org_slug(org_slug)
  );

drop policy if exists "user_module_guides_delete_own" on public.user_module_guides;
create policy "user_module_guides_delete_own"
  on public.user_module_guides for delete
  using (
    (select auth.uid()) = user_id
    and public.user_can_access_org_slug(org_slug)
  );

-- Edge rate bucket RPC: never callable by PostgREST clients.
revoke all on function public.claim_edge_rate_bucket(text, int, int) from public;
revoke all on function public.claim_edge_rate_bucket(text, int, int) from anon, authenticated;
grant execute on function public.claim_edge_rate_bucket(text, int, int) to service_role;

revoke all on table public.edge_rate_buckets from anon, authenticated;
grant all on table public.edge_rate_buckets to service_role;
