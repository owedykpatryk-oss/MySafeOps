-- Management workspace state moves from one document per organisation to one per
-- country workspace.
--
-- The local cache was always country-scoped (`management_overview_v1` goes through
-- loadOrgScoped, which appends the country suffix), while the cloud document was
-- organisation-wide. Editing the planner in Poland therefore pushed to the shared
-- document and pulled straight back into the United Kingdom. Per-country storage
-- makes both layers agree; the consolidated view is derived in the client from the
-- countries a user can actually read.

alter table public.management_workspaces
  add column if not exists workspace_id uuid references public.org_country_workspaces(id) on delete cascade;

alter table public.management_workspace_audit
  add column if not exists workspace_id uuid references public.org_country_workspaces(id) on delete cascade;

-- Existing state belongs to the organisation's primary country. Every organisation
-- received a primary workspace in 20260804173623, so this covers all rows; if any
-- row cannot be mapped the NOT NULL below aborts the whole migration rather than
-- silently dropping management data.
update public.management_workspaces mw
set workspace_id = w.id
from public.org_country_workspaces w
where w.org_id = mw.org_id
  and w.is_primary
  and mw.workspace_id is null;

update public.management_workspace_audit a
set workspace_id = w.id
from public.org_country_workspaces w
where w.org_id = a.org_id
  and w.is_primary
  and a.workspace_id is null;

alter table public.management_workspaces alter column workspace_id set not null;
alter table public.management_workspace_audit alter column workspace_id set not null;

alter table public.management_workspaces drop constraint management_workspaces_pkey;
alter table public.management_workspaces add primary key (workspace_id);

create index if not exists management_workspaces_org_idx
  on public.management_workspaces (org_id);
create index if not exists management_workspace_audit_workspace_created_idx
  on public.management_workspace_audit (workspace_id, created_at desc);

-- Access now needs organisation-admin rights *and* membership of that country, so a
-- country-restricted admin cannot read or write another country's plan.
drop policy if exists management_workspaces_select_admin on public.management_workspaces;
drop policy if exists management_workspaces_insert_admin on public.management_workspaces;
drop policy if exists management_workspaces_update_admin on public.management_workspaces;
drop policy if exists management_workspace_audit_select_admin on public.management_workspace_audit;

create policy management_workspaces_select_country_admin
  on public.management_workspaces
  for select
  to authenticated
  using (
    (select public.is_country_workspace_member(workspace_id))
    and exists (
      select 1
      from public.org_memberships membership
      where membership.org_id = management_workspaces.org_id
        and membership.user_id = (select auth.uid())
        and membership.role = 'admin'
    )
  );

create policy management_workspaces_insert_country_admin
  on public.management_workspaces
  for insert
  to authenticated
  with check (
    updated_by = (select auth.uid())
    and (select public.is_country_workspace_member(workspace_id))
    and exists (
      select 1
      from public.org_country_workspaces w
      where w.id = management_workspaces.workspace_id
        and w.org_id = management_workspaces.org_id
        and w.enabled
    )
    and exists (
      select 1
      from public.org_memberships membership
      where membership.org_id = management_workspaces.org_id
        and membership.user_id = (select auth.uid())
        and membership.role = 'admin'
    )
  );

create policy management_workspaces_update_country_admin
  on public.management_workspaces
  for update
  to authenticated
  using (
    (select public.is_country_workspace_member(workspace_id))
    and exists (
      select 1
      from public.org_memberships membership
      where membership.org_id = management_workspaces.org_id
        and membership.user_id = (select auth.uid())
        and membership.role = 'admin'
    )
  )
  with check (
    (select public.is_country_workspace_member(workspace_id))
    and exists (
      select 1
      from public.org_memberships membership
      where membership.org_id = management_workspaces.org_id
        and membership.user_id = (select auth.uid())
        and membership.role = 'admin'
    )
  );

create policy management_workspace_audit_select_country_admin
  on public.management_workspace_audit
  for select
  to authenticated
  using (
    (select public.is_country_workspace_member(workspace_id))
    and exists (
      select 1
      from public.org_memberships membership
      where membership.org_id = management_workspace_audit.org_id
        and membership.user_id = (select auth.uid())
        and membership.role = 'admin'
    )
  );

-- The audit trigger must carry the country through, and its authorisation check now
-- matches the table policies.
create or replace function mysafeops_private.audit_management_workspace_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null
    or not public.is_country_workspace_member(new.workspace_id)
    or not exists (
      select 1
      from public.org_memberships membership
      where membership.org_id = new.org_id
        and membership.user_id = auth.uid()
        and membership.role = 'admin'
    )
  then
    raise exception 'Management workspace audit denied' using errcode = '42501';
  end if;

  insert into public.management_workspace_audit (
    org_id,
    workspace_id,
    workspace_version,
    action,
    actor_user_id,
    previous_state,
    new_state
  ) values (
    new.org_id,
    new.workspace_id,
    new.version,
    case when tg_op = 'INSERT' then 'created' else 'updated' end,
    auth.uid(),
    case when tg_op = 'UPDATE' then old.state else null end,
    new.state
  );
  return new;
end;
$$;

revoke all on function mysafeops_private.audit_management_workspace_change() from public, anon, authenticated;

comment on table public.management_workspaces is
  'Management-only shared state, one document per paid country workspace. RLS requires organisation-admin rights and membership of that country.';
comment on column public.management_workspaces.workspace_id is
  'Owning country workspace. The organisation-wide view is derived client-side from the countries a user can read.';
