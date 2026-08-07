-- Shared, management-only workspace state.
-- One versioned JSON document per organisation keeps the existing offline-first
-- UI model while making teams, opportunities, job decisions and meeting notes
-- consistent across manager devices.

create table public.management_workspaces (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  state jsonb not null default '{}'::jsonb check (jsonb_typeof(state) = 'object'),
  version bigint not null default 1 check (version > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid not null default auth.uid() references auth.users(id) on delete restrict
);

create table public.management_workspace_audit (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations(id) on delete cascade,
  workspace_version bigint not null,
  action text not null check (action in ('created', 'updated')),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  previous_state jsonb,
  new_state jsonb not null,
  created_at timestamptz not null default now()
);

create index management_workspace_audit_org_created_idx
  on public.management_workspace_audit (org_id, created_at desc);

alter table public.management_workspaces enable row level security;
alter table public.management_workspace_audit enable row level security;

grant select, insert, update on public.management_workspaces to authenticated;
grant select on public.management_workspace_audit to authenticated;

create policy management_workspaces_select_admin
  on public.management_workspaces
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.org_memberships membership
      where membership.org_id = management_workspaces.org_id
        and membership.user_id = (select auth.uid())
        and membership.role = 'admin'
    )
  );

create policy management_workspaces_insert_admin
  on public.management_workspaces
  for insert
  to authenticated
  with check (
    updated_by = (select auth.uid())
    and exists (
      select 1
      from public.org_memberships membership
      where membership.org_id = management_workspaces.org_id
        and membership.user_id = (select auth.uid())
        and membership.role = 'admin'
    )
  );

create policy management_workspaces_update_admin
  on public.management_workspaces
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.org_memberships membership
      where membership.org_id = management_workspaces.org_id
        and membership.user_id = (select auth.uid())
        and membership.role = 'admin'
    )
  )
  with check (
    updated_by = (select auth.uid())
    and exists (
      select 1
      from public.org_memberships membership
      where membership.org_id = management_workspaces.org_id
        and membership.user_id = (select auth.uid())
        and membership.role = 'admin'
    )
  );

create policy management_workspace_audit_select_admin
  on public.management_workspace_audit
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.org_memberships membership
      where membership.org_id = management_workspace_audit.org_id
        and membership.user_id = (select auth.uid())
        and membership.role = 'admin'
    )
  );

create schema if not exists mysafeops_private;
revoke all on schema mysafeops_private from public, anon, authenticated;

create function mysafeops_private.prepare_management_workspace_update()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  new.version := old.version + 1;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

create trigger management_workspace_prepare_update
before update on public.management_workspaces
for each row execute function mysafeops_private.prepare_management_workspace_update();

create function mysafeops_private.audit_management_workspace_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null or not exists (
    select 1
    from public.org_memberships membership
    where membership.org_id = new.org_id
      and membership.user_id = auth.uid()
      and membership.role = 'admin'
  ) then
    raise exception 'Management workspace audit denied' using errcode = '42501';
  end if;

  insert into public.management_workspace_audit (
    org_id,
    workspace_version,
    action,
    actor_user_id,
    previous_state,
    new_state
  ) values (
    new.org_id,
    new.version,
    case when tg_op = 'INSERT' then 'created' else 'updated' end,
    auth.uid(),
    case when tg_op = 'UPDATE' then old.state else null end,
    new.state
  );
  return new;
end;
$$;

create trigger management_workspace_audit_change
after insert or update on public.management_workspaces
for each row execute function mysafeops_private.audit_management_workspace_change();

revoke all on function mysafeops_private.prepare_management_workspace_update() from public, anon, authenticated;
revoke all on function mysafeops_private.audit_management_workspace_change() from public, anon, authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'management_workspaces'
  ) then
    alter publication supabase_realtime add table public.management_workspaces;
  end if;
end;
$$;

comment on table public.management_workspaces is
  'Management-only shared state. RLS restricts all access to organisation admins.';
comment on table public.management_workspace_audit is
  'Immutable management workspace change history, visible only to organisation admins.';
