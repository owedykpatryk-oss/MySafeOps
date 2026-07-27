-- Organisation self-service deletion (GDPR Art. 17) with 30-day grace.
-- Admins schedule deletion; purge_orgs_past_deletion_grace removes rows after grace.
-- D1/R2 cleanup is triggered by Edge Function schedule-org-deletion (best-effort).

alter table public.organizations
  add column if not exists deletion_scheduled_at timestamptz,
  add column if not exists deletion_requested_by uuid references auth.users (id) on delete set null;

comment on column public.organizations.deletion_scheduled_at is
  'When set, org is pending erasure. Hard purge after 30 days via purge_orgs_past_deletion_grace.';

create or replace function public.schedule_my_org_deletion()
returns table (
  org_slug text,
  deletion_scheduled_at timestamptz,
  purge_after timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org_id uuid;
  v_role text;
  v_slug text;
  v_at timestamptz;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select m.org_id, m.role, o.slug
    into v_org_id, v_role, v_slug
  from public.org_memberships m
  join public.organizations o on o.id = m.org_id
  where m.user_id = v_uid
  limit 1;

  if v_org_id is null then
    raise exception 'No organisation membership';
  end if;
  if v_role is distinct from 'admin' then
    raise exception 'Only organisation admins can schedule deletion';
  end if;

  v_at := now();
  update public.organizations
     set deletion_scheduled_at = v_at,
         deletion_requested_by = v_uid
   where id = v_org_id;

  org_slug := v_slug;
  deletion_scheduled_at := v_at;
  purge_after := v_at + interval '30 days';
  return next;
end;
$$;

revoke all on function public.schedule_my_org_deletion() from public;
grant execute on function public.schedule_my_org_deletion() to authenticated;

create or replace function public.cancel_my_org_deletion()
returns table (
  org_slug text,
  cancelled boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org_id uuid;
  v_role text;
  v_slug text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select m.org_id, m.role, o.slug
    into v_org_id, v_role, v_slug
  from public.org_memberships m
  join public.organizations o on o.id = m.org_id
  where m.user_id = v_uid
  limit 1;

  if v_org_id is null then
    raise exception 'No organisation membership';
  end if;
  if v_role is distinct from 'admin' then
    raise exception 'Only organisation admins can cancel deletion';
  end if;

  update public.organizations
     set deletion_scheduled_at = null,
         deletion_requested_by = null
   where id = v_org_id;

  org_slug := v_slug;
  cancelled := true;
  return next;
end;
$$;

revoke all on function public.cancel_my_org_deletion() from public;
grant execute on function public.cancel_my_org_deletion() to authenticated;

create or replace function public.get_my_org_deletion_status()
returns table (
  org_slug text,
  deletion_scheduled_at timestamptz,
  purge_after timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    o.slug,
    o.deletion_scheduled_at,
    case
      when o.deletion_scheduled_at is null then null
      else o.deletion_scheduled_at + interval '30 days'
    end
  from public.org_memberships m
  join public.organizations o on o.id = m.org_id
  where m.user_id = auth.uid()
  limit 1;
$$;

revoke all on function public.get_my_org_deletion_status() from public;
grant execute on function public.get_my_org_deletion_status() to authenticated;

-- Purge expired client portal shares (soft expiry was already enforced in fetch RPC).
create or replace function public.purge_expired_client_portal_shares()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  delete from public.client_portal_shares
  where expires_at is not null
    and expires_at < now();
  get diagnostics v_count = row_count;
  return coalesce(v_count, 0);
end;
$$;

revoke all on function public.purge_expired_client_portal_shares() from public;
-- Service role / cron only — not granted to authenticated (avoids abuse as a DoS wipe).
grant execute on function public.purge_expired_client_portal_shares() to service_role;

comment on function public.purge_expired_client_portal_shares() is
  'Hard-deletes expired client_portal_shares rows. Call from Edge cron / schedule-org-deletion maintenance.';

-- Hard-delete orgs whose grace period ended. Cascades memberships via FK.
create or replace function public.purge_orgs_past_deletion_grace()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  delete from public.client_portal_shares cps
  using public.organizations o
  where cps.org_slug = o.slug
    and o.deletion_scheduled_at is not null
    and o.deletion_scheduled_at <= now() - interval '30 days';

  delete from public.org_invites i
  using public.organizations o
  where i.org_id = o.id
    and o.deletion_scheduled_at is not null
    and o.deletion_scheduled_at <= now() - interval '30 days';

  delete from public.organizations o
  where o.deletion_scheduled_at is not null
    and o.deletion_scheduled_at <= now() - interval '30 days';
  get diagnostics v_count = row_count;
  return coalesce(v_count, 0);
end;
$$;

revoke all on function public.purge_orgs_past_deletion_grace() from public;
grant execute on function public.purge_orgs_past_deletion_grace() to service_role;

comment on function public.purge_orgs_past_deletion_grace() is
  'Deletes organisations 30+ days after deletion_scheduled_at. Run via service-role cron.';
