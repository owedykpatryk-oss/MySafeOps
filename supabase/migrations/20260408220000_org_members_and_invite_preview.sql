-- MySafeOps: list/update/remove org members + public invite preview for landing page.

-- Preview invite without auth (anon) — used by /accept-invite landing.
create or replace function public.get_invite_preview(p_token text)
returns table (
  org_name text,
  invite_email text,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select o.name::text, i.email::text, i.expires_at
  from public.org_invites i
  join public.organizations o on o.id = i.org_id
  where i.invite_token = p_token
    and i.status = 'pending'
    and i.expires_at > now()
  limit 1;
$$;

grant execute on function public.get_invite_preview(text) to anon, authenticated;

-- Members of caller's organisation (emails from auth.users).
create or replace function public.list_org_members()
returns table (
  user_id uuid,
  email text,
  role text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select m.org_id into v_org_id
  from public.org_memberships m
  where m.user_id = v_uid
  limit 1;

  if v_org_id is null then
    raise exception 'No organisation membership';
  end if;

  return query
  select m.user_id, u.email::text, m.role, m.created_at
  from public.org_memberships m
  join auth.users u on u.id = m.user_id
  where m.org_id = v_org_id
  order by m.created_at asc;
end;
$$;

grant execute on function public.list_org_members() to authenticated;

create or replace function public.update_org_member_role(p_target uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org_id uuid;
  v_admin_count int;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if p_target is null then raise exception 'Invalid target'; end if;
  if p_role not in ('admin', 'supervisor', 'operative') then
    raise exception 'Invalid role';
  end if;

  select m.org_id into v_org_id from public.org_memberships m where m.user_id = v_uid limit 1;
  if v_org_id is null then raise exception 'No organisation membership'; end if;

  if not exists (
    select 1 from public.org_memberships m
    where m.user_id = v_uid and m.org_id = v_org_id and m.role = 'admin'
  ) then
    raise exception 'Only admins can change roles';
  end if;

  if not exists (
    select 1 from public.org_memberships m
    where m.user_id = p_target and m.org_id = v_org_id
  ) then
    raise exception 'User is not in this organisation';
  end if;

  select count(*)::int into v_admin_count
  from public.org_memberships m
  where m.org_id = v_org_id and m.role = 'admin';

  if p_target = v_uid and p_role <> 'admin' and v_admin_count <= 1 then
    raise exception 'Cannot demote the last admin';
  end if;

  if exists (
    select 1 from public.org_memberships m
    where m.user_id = p_target and m.org_id = v_org_id and m.role = 'admin'
  ) and p_role <> 'admin' and v_admin_count <= 1 then
    raise exception 'Cannot demote the last admin';
  end if;

  update public.org_memberships
    set role = p_role
  where user_id = p_target and org_id = v_org_id;
end;
$$;

grant execute on function public.update_org_member_role(uuid, text) to authenticated;

create or replace function public.remove_org_member(p_target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org_id uuid;
  v_admin_count int;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if p_target is null then raise exception 'Invalid target'; end if;

  select m.org_id into v_org_id from public.org_memberships m where m.user_id = v_uid limit 1;
  if v_org_id is null then raise exception 'No organisation membership'; end if;

  if not exists (
    select 1 from public.org_memberships m
    where m.user_id = v_uid and m.org_id = v_org_id and m.role = 'admin'
  ) then
    raise exception 'Only admins can remove members';
  end if;

  if not exists (
    select 1 from public.org_memberships m
    where m.user_id = p_target and m.org_id = v_org_id
  ) then
    raise exception 'User is not in this organisation';
  end if;

  select count(*)::int into v_admin_count
  from public.org_memberships m
  where m.org_id = v_org_id and m.role = 'admin';

  if p_target = v_uid and v_admin_count <= 1 then
    raise exception 'Cannot remove the last admin';
  end if;

  if exists (
    select 1 from public.org_memberships m
    where m.user_id = p_target and m.org_id = v_org_id and m.role = 'admin'
  ) and v_admin_count <= 1 then
    raise exception 'Cannot remove the last admin';
  end if;

  delete from public.org_memberships
  where user_id = p_target and org_id = v_org_id;
end;
$$;

grant execute on function public.remove_org_member(uuid) to authenticated;
