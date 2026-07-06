-- Namespace-scoped D1 KV writes: operatives cannot overwrite org-wide master data.

create or replace function public.user_can_write_org_kv(p_org_slug text, p_namespace text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text;
  v_ns text;
begin
  v_ns := trim(coalesce(p_namespace, ''));
  if char_length(v_ns) < 1 or char_length(v_ns) > 128 then
    return false;
  end if;
  if v_ns !~ '^[a-zA-Z0-9_.-]+$' then
    return false;
  end if;

  select m.role into v_role
  from public.org_memberships m
  join public.organizations o on o.id = m.org_id
  where m.user_id = auth.uid()
    and o.slug = p_org_slug
  limit 1;

  if v_role is null then
    return false;
  end if;

  if v_role in ('admin', 'supervisor') then
    return true;
  end if;

  if v_role = 'operative' and v_ns in (
    'mysafeops_workers',
    'mysafeops_projects',
    'training_matrix',
    'cdm_packs',
    'mysafeops_timesheets'
  ) then
    return false;
  end if;

  return v_role = 'operative';
end;
$$;

grant execute on function public.user_can_write_org_kv(text, text) to authenticated;

comment on function public.user_can_write_org_kv(text, text) is
  'Cloudflare D1 PUT /v1/kv — admin/supervisor any namespace; operative blocked from org master-data namespaces.';
