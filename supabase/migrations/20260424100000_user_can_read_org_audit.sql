-- D1 Worker: restrict GET /v1/audit and GET /v1/audit/verify to admin + supervisor (not operative).
-- POST /v1/audit/append stays on user_can_access_org_slug (any org member can emit events).

create or replace function public.user_can_read_org_audit(p_org_slug text)
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

grant execute on function public.user_can_read_org_audit(text) to authenticated;

comment on function public.user_can_read_org_audit(text) is
  'True if the user is an admin or supervisor in the org; used by Cloudflare D1 Worker for audit log read/verify.';
