-- Durable Edge rate-limit buckets (service-role / security definer only).
-- Complements isolate-local Maps so multi-isolate spam still hits a shared ceiling.

create table if not exists public.edge_rate_buckets (
  bucket_key text primary key,
  window_start timestamptz not null,
  count int not null default 0
);

comment on table public.edge_rate_buckets is
  'Sliding-window counters for Supabase Edge Functions; claimed via claim_edge_rate_bucket.';

alter table public.edge_rate_buckets enable row level security;

-- No direct client access — only security definer RPC.
revoke all on table public.edge_rate_buckets from anon, authenticated;
grant all on table public.edge_rate_buckets to service_role;

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
  v_start timestamptz;
  v_count int;
begin
  if v_key is null then
    return false;
  end if;

  select window_start, count
    into v_start, v_count
  from public.edge_rate_buckets
  where bucket_key = v_key
  for update;

  if not found then
    insert into public.edge_rate_buckets (bucket_key, window_start, count)
    values (v_key, v_now, 1);
    return true;
  end if;

  if v_start + make_interval(secs => v_win) < v_now then
    update public.edge_rate_buckets
    set window_start = v_now, count = 1
    where bucket_key = v_key;
    return true;
  end if;

  if v_count >= v_max then
    return false;
  end if;

  update public.edge_rate_buckets
  set count = v_count + 1
  where bucket_key = v_key;
  return true;
end;
$$;

revoke all on function public.claim_edge_rate_bucket(text, int, int) from public;
grant execute on function public.claim_edge_rate_bucket(text, int, int) to service_role;

-- Stop PostgREST clients from reading live invite plaintext (hash + RPCs remain).
revoke select (invite_token) on table public.org_invites from anon, authenticated;
