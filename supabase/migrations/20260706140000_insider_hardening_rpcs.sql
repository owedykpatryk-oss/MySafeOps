-- Insider hardening: lightweight role read + D1 KV delete restricted to admin/supervisor.

create or replace function public.get_my_membership_role(p_org_slug text default null)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select m.role::text
  from public.org_memberships m
  join public.organizations o on o.id = m.org_id
  where m.user_id = auth.uid()
    and (p_org_slug is null or o.slug = p_org_slug)
  limit 1;
$$;

grant execute on function public.get_my_membership_role(text) to authenticated;

comment on function public.get_my_membership_role(text) is
  'Returns the authenticated user role in their org (optional slug filter). No side effects — use for UI role refresh.';

create or replace function public.user_can_delete_org_kv(p_org_slug text)
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
      and m.role in ('admin', 'supervisor')
  );
$$;

grant execute on function public.user_can_delete_org_kv(text) to authenticated;

comment on function public.user_can_delete_org_kv(text) is
  'True if user is admin or supervisor in the org; used by Cloudflare D1 API Worker for DELETE /v1/kv.';
