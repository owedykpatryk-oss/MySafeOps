-- Supabase: RPC for Cloudflare D1 / Workers — verify caller may read/write data for an org slug.
-- Worker calls: POST /rest/v1/rpc/user_can_access_org_slug with user JWT and body {"p_org_slug":"..."}

create or replace function public.user_can_access_org_slug(p_org_slug text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.org_memberships m
    join public.organizations o on o.id = m.org_id
    where m.user_id = auth.uid()
      and o.slug = p_org_slug
  );
$$;

grant execute on function public.user_can_access_org_slug(text) to authenticated;

comment on function public.user_can_access_org_slug(text) is
  'Returns true if the authenticated user is a member of the organisation with the given slug; used by Cloudflare D1 API Worker.';
