-- Scale hardening: atomic edge rate buckets, service-role member emails, invite rate index, bucket prune.

-- 1) Atomic claim (no SELECT FOR UPDATE + INSERT race → unique_violation → fail-open)
create or replace function public.claim_edge_rate_bucket(
  p_key text,
  p_max int,
  p_window_seconds int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text := nullif(trim(coalesce(p_key, '')), '');
  v_max int := greatest(1, coalesce(p_max, 1));
  v_win int := greatest(1, coalesce(p_window_seconds, 60));
  v_now timestamptz := now();
  v_count int;
begin
  if v_key is null then
    return false;
  end if;

  insert into public.edge_rate_buckets as b (bucket_key, window_start, count)
  values (v_key, v_now, 1)
  on conflict (bucket_key) do update
  set
    window_start = case
      when b.window_start + make_interval(secs => v_win) < excluded.window_start
        then excluded.window_start
      else b.window_start
    end,
    count = case
      when b.window_start + make_interval(secs => v_win) < excluded.window_start
        then 1
      else b.count + 1
    end
  where
    b.window_start + make_interval(secs => v_win) < excluded.window_start
    or b.count < v_max
  returning b.count into v_count;

  return v_count is not null;
end;
$$;

revoke all on function public.claim_edge_rate_bucket(text, int, int) from public;
revoke all on function public.claim_edge_rate_bucket(text, int, int) from anon, authenticated;
grant execute on function public.claim_edge_rate_bucket(text, int, int) to service_role;

-- 2) Prune stale buckets (call from Edge periodically or cron)
create or replace function public.prune_edge_rate_buckets(p_older_than interval default interval '1 day')
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted int;
begin
  delete from public.edge_rate_buckets
  where window_start < now() - p_older_than;
  get diagnostics v_deleted = row_count;
  return coalesce(v_deleted, 0);
end;
$$;

revoke all on function public.prune_edge_rate_buckets(interval) from public;
revoke all on function public.prune_edge_rate_buckets(interval) from anon, authenticated;
grant execute on function public.prune_edge_rate_buckets(interval) to service_role;

-- 3) One-shot org member emails for Edge notify (avoids N× auth.admin.getUserById)
create or replace function public.list_org_member_emails(p_org_id uuid)
returns table (email text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_org_id is null then
    return;
  end if;

  return query
  select distinct lower(u.email)::text
  from public.org_memberships m
  join auth.users u on u.id = m.user_id
  where m.org_id = p_org_id
    and u.email is not null
    and length(trim(u.email)) > 3;
end;
$$;

revoke all on function public.list_org_member_emails(uuid) from public;
revoke all on function public.list_org_member_emails(uuid) from anon, authenticated;
grant execute on function public.list_org_member_emails(uuid) to service_role;

-- 4) Invite org hourly rate query
create index if not exists org_invites_org_email_attempted_idx
  on public.org_invites (org_id, email_delivery_attempted_at desc);
