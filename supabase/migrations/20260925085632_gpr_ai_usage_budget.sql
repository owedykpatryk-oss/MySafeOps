-- Fixed, user-scoped OpenAI budget for evidence-backed GPR reviews.
-- The caller cannot raise these limits: the function accepts no quota arguments
-- and derives the bucket key from the verified Supabase JWT.

create or replace function public.claim_gpr_ai_usage_budget()
returns table (
  allowed boolean,
  minute_allowed boolean,
  daily_allowed boolean,
  monthly_allowed boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_minute boolean := false;
  v_daily boolean := false;
  v_monthly boolean := false;
begin
  if v_user_id is null then
    return query select false, false, false, false;
    return;
  end if;

  -- Cheap model + bounded output, but still keep a hard shared-database ceiling.
  v_minute := public.claim_edge_rate_bucket(
    'gpr-ai:user:' || v_user_id::text || ':minute', 2, 60
  );
  if not v_minute then
    return query select false, false, true, true;
    return;
  end if;

  v_daily := public.claim_edge_rate_bucket(
    'gpr-ai:user:' || v_user_id::text || ':day', 10, 86400
  );
  if not v_daily then
    return query select false, true, false, true;
    return;
  end if;

  v_monthly := public.claim_edge_rate_bucket(
    'gpr-ai:user:' || v_user_id::text || ':month', 100, 2592000
  );
  return query select (v_minute and v_daily and v_monthly), v_minute, v_daily, v_monthly;
end;
$$;

revoke all on function public.claim_gpr_ai_usage_budget() from public;
revoke all on function public.claim_gpr_ai_usage_budget() from anon;
grant execute on function public.claim_gpr_ai_usage_budget() to authenticated;

comment on function public.claim_gpr_ai_usage_budget() is
  'Claims fixed GPR AI quotas (2/min, 10/rolling day, 100/rolling 30 days) for auth.uid().';
