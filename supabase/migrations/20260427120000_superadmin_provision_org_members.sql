-- Platform owner: attach auth users to one organisation by email (merge solo workspaces).

create or replace function public.superadmin_provision_org_members(
  p_org_slug text,
  p_org_name text,
  p_emails text[],
  p_role text default 'admin'
)
returns table (
  out_email text,
  out_user_id uuid,
  out_org_slug text,
  out_action text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  v_ok boolean;
  v_org_id uuid;
  v_slug text;
  v_name text;
  v_role text;
  v_owner uuid;
  v_raw text;
  v_norm text;
  v_uid uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select exists (select 1 from public.platform_owner_email_allowlist e where e.email = v_email) into v_ok;
  if not v_ok then
    raise exception 'Not authorized';
  end if;

  v_slug := lower(trim(regexp_replace(coalesce(p_org_slug, ''), '[^a-z0-9]+', '-', 'g')));
  v_slug := trim(both '-' from v_slug);
  if v_slug = '' then
    raise exception 'Invalid organisation slug';
  end if;

  v_name := nullif(trim(coalesce(p_org_name, '')), '');
  if v_name is null then
    raise exception 'Organisation name is required';
  end if;

  v_role := lower(trim(coalesce(p_role, 'admin')));
  if v_role not in ('admin', 'supervisor', 'operative') then
    raise exception 'Invalid role';
  end if;

  if p_emails is null or array_length(p_emails, 1) is null then
    raise exception 'At least one email is required';
  end if;

  select o.id into v_org_id from public.organizations o where o.slug = v_slug limit 1;

  if v_org_id is null then
    v_owner := null;
    foreach v_raw in array p_emails loop
      v_norm := lower(trim(v_raw));
      if v_norm = '' then
        continue;
      end if;
      select u.id into v_uid from auth.users u where lower(u.email) = v_norm limit 1;
      if v_uid is not null then
        v_owner := v_uid;
        exit;
      end if;
    end loop;

    if v_owner is null then
      raise exception 'No matching auth users found — accounts must sign up first';
    end if;

    insert into public.organizations (slug, name, owner_user_id)
    values (v_slug, v_name, v_owner)
    returning id into v_org_id;
  else
    update public.organizations
    set name = v_name
    where id = v_org_id;
  end if;

  foreach v_raw in array p_emails loop
    out_email := lower(trim(v_raw));
    out_org_slug := v_slug;
    out_user_id := null;
    out_action := 'skipped';

    if out_email = '' then
      out_action := 'empty_email';
      return next;
      continue;
    end if;

    select u.id into v_uid from auth.users u where lower(u.email) = out_email limit 1;
    if v_uid is null then
      out_action := 'user_not_found';
      return next;
      continue;
    end if;

    out_user_id := v_uid;

    insert into public.org_memberships (user_id, org_id, role)
    values (v_uid, v_org_id, v_role)
    on conflict (user_id) do update
      set org_id = excluded.org_id,
          role = excluded.role;

    out_action := 'attached';
    return next;
  end loop;
end;
$$;

revoke all on function public.superadmin_provision_org_members(text, text, text[], text) from public;
grant execute on function public.superadmin_provision_org_members(text, text, text[], text) to authenticated;

comment on function public.superadmin_provision_org_members(text, text, text[], text) is
  'Platform owner: create/update org by slug and attach users as members (merge solo workspaces).';
