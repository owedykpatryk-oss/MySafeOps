-- One customer organisation can operate independently billed country workspaces.
-- Existing organisations are migrated into a primary UK workspace; the client may
-- safely correct that auto-migrated market from its existing org market setting.

create table if not exists public.org_country_workspaces (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  market_id text not null check (market_id in ('uk', 'pl', 'au')),
  display_name text not null,
  default_document_locale text not null check (default_document_locale in ('en-GB', 'pl-PL', 'en-AU')),
  is_primary boolean not null default false,
  enabled boolean not null default true,
  migration_source text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, market_id)
);

create unique index if not exists org_country_workspaces_one_primary_idx
  on public.org_country_workspaces (org_id)
  where is_primary;
create index if not exists org_country_workspaces_org_enabled_idx
  on public.org_country_workspaces (org_id, enabled, market_id);

create table if not exists public.org_country_workspace_memberships (
  workspace_id uuid not null references public.org_country_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('country_admin', 'supervisor', 'operative', 'read_only')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index if not exists org_country_workspace_memberships_user_idx
  on public.org_country_workspace_memberships (user_id, workspace_id);

create table if not exists public.org_country_workspace_subscriptions (
  workspace_id uuid not null references public.org_country_workspaces(id) on delete cascade,
  stripe_mode text not null default 'live' check (stripe_mode in ('live', 'test')),
  market_id text not null check (market_id in ('uk', 'pl', 'au')),
  currency text not null check (currency in ('GBP', 'PLN', 'AUD')),
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  billing_plan text check (billing_plan is null or billing_plan in ('starter', 'team', 'business', 'enterprise', 'enterprise_plus')),
  subscription_status text not null default 'none'
    check (subscription_status in ('none', 'incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused')),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  stripe_trial_end timestamptz,
  past_due_since timestamptz,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, stripe_mode)
);

create unique index if not exists org_country_workspace_subscriptions_stripe_sub_idx
  on public.org_country_workspace_subscriptions (stripe_subscription_id)
  where stripe_subscription_id is not null;
create index if not exists org_country_workspace_subscriptions_customer_idx
  on public.org_country_workspace_subscriptions (stripe_customer_id, stripe_mode)
  where stripe_customer_id is not null;
create index if not exists org_country_workspace_subscriptions_status_idx
  on public.org_country_workspace_subscriptions (subscription_status, current_period_end);

create table if not exists public.org_user_preferences (
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  active_workspace_id uuid references public.org_country_workspaces(id) on delete set null,
  ui_locale text not null default 'en-GB',
  updated_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create index if not exists org_user_preferences_active_workspace_idx
  on public.org_user_preferences (active_workspace_id)
  where active_workspace_id is not null;

create table if not exists public.org_document_language_preferences (
  workspace_id uuid not null references public.org_country_workspaces(id) on delete cascade,
  document_type text not null,
  document_locale text not null,
  bilingual_secondary_locale text,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, document_type),
  check (length(trim(document_type)) between 1 and 80),
  check (document_locale in ('en-GB', 'pl-PL', 'en-AU')),
  check (bilingual_secondary_locale is null or bilingual_secondary_locale in ('en-GB', 'pl-PL', 'en-AU'))
);

-- Backwards-compatible primary workspace and billing migration.
insert into public.org_country_workspaces (
  org_id, market_id, display_name, default_document_locale, is_primary,
  migration_source, created_by
)
select o.id, 'uk', 'United Kingdom', 'en-GB', true, 'legacy_organization', o.owner_user_id
from public.organizations o
on conflict (org_id, market_id) do nothing;

insert into public.org_country_workspace_memberships (workspace_id, user_id, role)
select w.id, m.user_id,
  case m.role
    when 'admin' then 'country_admin'
    when 'supervisor' then 'supervisor'
    else 'operative'
  end
from public.org_country_workspaces w
join public.org_memberships m on m.org_id = w.org_id
where w.is_primary
on conflict (workspace_id, user_id) do nothing;

insert into public.org_document_language_preferences (workspace_id, document_type, document_locale)
select w.id, document_type, w.default_document_locale
from public.org_country_workspaces w
cross join unnest(array['rams', 'permit', 'survey', 'site_report']) as document_type
on conflict (workspace_id, document_type) do nothing;

insert into public.org_country_workspace_subscriptions (
  workspace_id, stripe_mode, market_id, currency, stripe_customer_id,
  stripe_subscription_id, billing_plan, subscription_status,
  current_period_end, cancel_at_period_end, stripe_trial_end, past_due_since
)
select w.id, 'live', w.market_id, 'GBP', o.stripe_customer_id,
  o.stripe_subscription_id, o.billing_plan, coalesce(o.subscription_status, 'none'),
  o.stripe_current_period_end, coalesce(o.stripe_cancel_at_period_end, false),
  o.stripe_trial_end, o.subscription_past_due_since
from public.org_country_workspaces w
join public.organizations o on o.id = w.org_id
where w.is_primary
on conflict (workspace_id, stripe_mode) do nothing;

-- Keep country authorization aligned when organisation memberships change.
-- New administrators receive all countries; other new members start in the
-- primary country and may subsequently be assigned elsewhere by an admin.
create or replace function public.sync_org_country_workspace_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_user_id uuid;
  v_role text;
begin
  if tg_op = 'DELETE' then
    v_org_id := old.org_id;
    v_user_id := old.user_id;
    delete from public.org_country_workspace_memberships wm
    using public.org_country_workspaces w
    where wm.workspace_id = w.id
      and w.org_id = v_org_id
      and wm.user_id = v_user_id;
    return old;
  end if;

  v_org_id := new.org_id;
  v_user_id := new.user_id;
  v_role := case new.role
    when 'admin' then 'country_admin'
    when 'supervisor' then 'supervisor'
    else 'operative'
  end;

  if tg_op = 'UPDATE' and new.role <> 'admin' then
    delete from public.org_country_workspace_memberships wm
    using public.org_country_workspaces w
    where wm.workspace_id = w.id
      and w.org_id = v_org_id
      and wm.user_id = v_user_id
      and not w.is_primary;
  end if;

  insert into public.org_country_workspace_memberships (workspace_id, user_id, role)
  select w.id, v_user_id, v_role
  from public.org_country_workspaces w
  where w.org_id = v_org_id
    and (new.role = 'admin' or w.is_primary)
  on conflict (workspace_id, user_id) do update set role = excluded.role;

  return new;
end;
$$;

drop trigger if exists trg_sync_org_country_workspace_membership on public.org_memberships;
create trigger trg_sync_org_country_workspace_membership
after insert or update or delete on public.org_memberships
for each row execute function public.sync_org_country_workspace_membership();

alter table public.organizations drop constraint if exists organizations_subscription_status_check;
alter table public.organizations
  add constraint organizations_subscription_status_check
  check (subscription_status in ('none', 'incomplete', 'incomplete_expired', 'active', 'trialing', 'past_due', 'canceled', 'unpaid', 'paused'));

create or replace function public.touch_org_country_workspace_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_org_country_workspaces_updated_at on public.org_country_workspaces;
create trigger trg_org_country_workspaces_updated_at
before update on public.org_country_workspaces
for each row execute function public.touch_org_country_workspace_updated_at();

drop trigger if exists trg_org_country_workspace_subscriptions_updated_at on public.org_country_workspace_subscriptions;
create trigger trg_org_country_workspace_subscriptions_updated_at
before update on public.org_country_workspace_subscriptions
for each row execute function public.touch_org_country_workspace_updated_at();

drop trigger if exists trg_org_user_preferences_updated_at on public.org_user_preferences;
create trigger trg_org_user_preferences_updated_at
before update on public.org_user_preferences
for each row execute function public.touch_org_country_workspace_updated_at();

drop trigger if exists trg_org_document_language_preferences_updated_at on public.org_document_language_preferences;
create trigger trg_org_document_language_preferences_updated_at
before update on public.org_document_language_preferences
for each row execute function public.touch_org_country_workspace_updated_at();

alter table public.org_country_workspaces enable row level security;
alter table public.org_country_workspace_memberships enable row level security;
alter table public.org_country_workspace_subscriptions enable row level security;
alter table public.org_user_preferences enable row level security;
alter table public.org_document_language_preferences enable row level security;

-- Avoid policy recursion between workspace and workspace-membership tables while
-- keeping country access server-authoritative. This helper exposes only a boolean
-- entitlement for the current authenticated user.
create or replace function public.is_country_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.org_country_workspace_memberships wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = auth.uid()
  );
$$;

revoke all on function public.is_country_workspace_member(uuid) from public, anon;
grant execute on function public.is_country_workspace_member(uuid) to authenticated;

create policy org_country_workspaces_select_member
on public.org_country_workspaces for select to authenticated
using (
  (select public.is_country_workspace_member(id))
);

create policy org_country_workspaces_insert_admin
on public.org_country_workspaces for insert to authenticated
with check (
  org_id in (
    select m.org_id from public.org_memberships m
    where m.user_id = (select auth.uid()) and m.role = 'admin'
  )
  and created_by = (select auth.uid())
);

create policy org_country_workspaces_update_admin
on public.org_country_workspaces for update to authenticated
using (
  org_id in (
    select m.org_id from public.org_memberships m
    where m.user_id = (select auth.uid()) and m.role = 'admin'
  )
)
with check (
  org_id in (
    select m.org_id from public.org_memberships m
    where m.user_id = (select auth.uid()) and m.role = 'admin'
  )
);

create policy org_country_workspace_memberships_select
on public.org_country_workspace_memberships for select to authenticated
using (
  user_id = (select auth.uid())
  or workspace_id in (
    select w.id
    from public.org_country_workspaces w
    join public.org_memberships m on m.org_id = w.org_id
    where m.user_id = (select auth.uid()) and m.role = 'admin'
  )
);

create policy org_country_workspace_memberships_insert_admin
on public.org_country_workspace_memberships for insert to authenticated
with check (
  workspace_id in (
    select w.id
    from public.org_country_workspaces w
    join public.org_memberships m on m.org_id = w.org_id
    where m.user_id = (select auth.uid()) and m.role = 'admin'
  )
  and user_id in (
    select m2.user_id
    from public.org_memberships m2
    join public.org_country_workspaces w2 on w2.org_id = m2.org_id
    where w2.id = org_country_workspace_memberships.workspace_id
  )
);

create policy org_country_workspace_memberships_update_admin
on public.org_country_workspace_memberships for update to authenticated
using (
  workspace_id in (
    select w.id
    from public.org_country_workspaces w
    join public.org_memberships m on m.org_id = w.org_id
    where m.user_id = (select auth.uid()) and m.role = 'admin'
  )
)
with check (
  workspace_id in (
    select w.id
    from public.org_country_workspaces w
    join public.org_memberships m on m.org_id = w.org_id
    where m.user_id = (select auth.uid()) and m.role = 'admin'
  )
  and user_id in (
    select m2.user_id
    from public.org_memberships m2
    join public.org_country_workspaces w2 on w2.org_id = m2.org_id
    where w2.id = org_country_workspace_memberships.workspace_id
  )
);

create policy org_country_workspace_memberships_delete_admin
on public.org_country_workspace_memberships for delete to authenticated
using (
  workspace_id in (
    select w.id
    from public.org_country_workspaces w
    join public.org_memberships m on m.org_id = w.org_id
    where m.user_id = (select auth.uid()) and m.role = 'admin'
  )
);

create policy org_country_workspace_subscriptions_select_admin
on public.org_country_workspace_subscriptions for select to authenticated
using (
  workspace_id in (
    select w.id
    from public.org_country_workspaces w
    join public.org_memberships m on m.org_id = w.org_id
    where m.user_id = (select auth.uid()) and m.role = 'admin'
  )
);

create policy org_user_preferences_select_own
on public.org_user_preferences for select to authenticated
using (
  user_id = (select auth.uid())
  and org_id in (
    select m.org_id from public.org_memberships m
    where m.user_id = (select auth.uid())
  )
);

create policy org_user_preferences_insert_own
on public.org_user_preferences for insert to authenticated
with check (
  user_id = (select auth.uid())
  and org_id in (
    select m.org_id from public.org_memberships m
    where m.user_id = (select auth.uid())
  )
  and (
    active_workspace_id is null
    or active_workspace_id in (
      select w.id from public.org_country_workspaces w where w.org_id = org_user_preferences.org_id
    )
  )
);

create policy org_user_preferences_update_own
on public.org_user_preferences for update to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and org_id in (
    select m.org_id from public.org_memberships m
    where m.user_id = (select auth.uid())
  )
  and (
    active_workspace_id is null
    or active_workspace_id in (
      select w.id from public.org_country_workspaces w where w.org_id = org_user_preferences.org_id
    )
  )
);

create policy org_document_language_preferences_select_member
on public.org_document_language_preferences for select to authenticated
using (
  workspace_id in (
    select w.id from public.org_country_workspaces w
    where w.org_id in (
      select m.org_id from public.org_memberships m
      where m.user_id = (select auth.uid())
    )
  )
);

create policy org_document_language_preferences_insert_admin
on public.org_document_language_preferences for insert to authenticated
with check (
  workspace_id in (
    select w.id
    from public.org_country_workspaces w
    join public.org_memberships m on m.org_id = w.org_id
    where m.user_id = (select auth.uid()) and m.role = 'admin'
  )
);

create policy org_document_language_preferences_update_admin
on public.org_document_language_preferences for update to authenticated
using (
  workspace_id in (
    select w.id
    from public.org_country_workspaces w
    join public.org_memberships m on m.org_id = w.org_id
    where m.user_id = (select auth.uid()) and m.role = 'admin'
  )
)
with check (
  workspace_id in (
    select w.id
    from public.org_country_workspaces w
    join public.org_memberships m on m.org_id = w.org_id
    where m.user_id = (select auth.uid()) and m.role = 'admin'
  )
);

create policy org_document_language_preferences_delete_admin
on public.org_document_language_preferences for delete to authenticated
using (
  workspace_id in (
    select w.id
    from public.org_country_workspaces w
    join public.org_memberships m on m.org_id = w.org_id
    where m.user_id = (select auth.uid()) and m.role = 'admin'
  )
);

grant select, insert, update on public.org_country_workspaces to authenticated;
grant select, insert, update, delete on public.org_country_workspace_memberships to authenticated;
grant select on public.org_country_workspace_subscriptions to authenticated;
grant select, insert, update on public.org_user_preferences to authenticated;
grant select, insert, update, delete on public.org_document_language_preferences to authenticated;

comment on table public.org_country_workspaces is
  'Paid operational country workspaces within one customer organisation.';
comment on table public.org_country_workspace_subscriptions is
  'Server-owned Stripe subscription state, one independent subscription per country workspace and Stripe mode.';
comment on column public.org_user_preferences.ui_locale is
  'User interface locale; independent from workspace document language.';

-- One-time compatibility claim: an authenticated organisation admin may align
-- the single auto-migrated legacy workspace with the organisation's existing
-- market setting. It cannot move or modify non-legacy workspaces.
create or replace function public.claim_legacy_country_workspace(
  p_org_slug text,
  p_market_id text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org_id uuid;
  v_workspace_id uuid;
  v_locale text;
  v_name text;
  v_currency text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if p_market_id not in ('uk', 'pl', 'au') then
    raise exception 'Unsupported market';
  end if;

  select o.id into v_org_id
  from public.organizations o
  join public.org_memberships m on m.org_id = o.id
  where o.slug = p_org_slug
    and m.user_id = v_uid
    and m.role = 'admin'
  limit 1;
  if v_org_id is null then
    raise exception 'Only organisation admins can claim a legacy country workspace';
  end if;

  select w.id into v_workspace_id
  from public.org_country_workspaces w
  where w.org_id = v_org_id
    and w.migration_source = 'legacy_organization'
    and w.is_primary
    and (select count(*) from public.org_country_workspaces x where x.org_id = v_org_id) = 1
  limit 1;
  if v_workspace_id is null then
    select w.id into v_workspace_id
    from public.org_country_workspaces w
    where w.org_id = v_org_id and w.market_id = p_market_id
    limit 1;
    return v_workspace_id;
  end if;

  v_locale := case p_market_id when 'pl' then 'pl-PL' when 'au' then 'en-AU' else 'en-GB' end;
  v_name := case p_market_id when 'pl' then 'Poland' when 'au' then 'Australia' else 'United Kingdom' end;
  v_currency := case p_market_id when 'pl' then 'PLN' when 'au' then 'AUD' else 'GBP' end;

  update public.org_country_workspaces
  set market_id = p_market_id,
      display_name = v_name,
      default_document_locale = v_locale,
      migration_source = 'legacy_claimed'
  where id = v_workspace_id;

  update public.org_country_workspace_subscriptions
  set market_id = p_market_id,
      currency = v_currency
  where workspace_id = v_workspace_id;

  return v_workspace_id;
end;
$$;

revoke all on function public.claim_legacy_country_workspace(text, text) from public, anon;
grant execute on function public.claim_legacy_country_workspace(text, text) to authenticated;

create or replace function public.add_org_country_workspace(
  p_org_slug text,
  p_market_id text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org_id uuid;
  v_workspace_id uuid;
  v_locale text;
  v_name text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if p_market_id not in ('uk', 'pl', 'au') then
    raise exception 'Unsupported market';
  end if;

  select o.id into v_org_id
  from public.organizations o
  join public.org_memberships m on m.org_id = o.id
  where o.slug = p_org_slug
    and m.user_id = v_uid
    and m.role = 'admin'
  limit 1;
  if v_org_id is null then
    raise exception 'Only organisation admins can add countries';
  end if;

  v_locale := case p_market_id when 'pl' then 'pl-PL' when 'au' then 'en-AU' else 'en-GB' end;
  v_name := case p_market_id when 'pl' then 'Poland' when 'au' then 'Australia' else 'United Kingdom' end;

  insert into public.org_country_workspaces (
    org_id, market_id, display_name, default_document_locale, is_primary,
    enabled, created_by
  )
  values (v_org_id, p_market_id, v_name, v_locale, false, true, v_uid)
  returning id into v_workspace_id;

  insert into public.org_country_workspace_memberships (workspace_id, user_id, role)
  select v_workspace_id, m.user_id,
    case m.role
      when 'admin' then 'country_admin'
      when 'supervisor' then 'supervisor'
      else 'operative'
    end
  from public.org_memberships m
  where m.org_id = v_org_id
  on conflict (workspace_id, user_id) do nothing;

  insert into public.org_document_language_preferences (
    workspace_id, document_type, document_locale
  )
  select v_workspace_id, document_type, v_locale
  from unnest(array['rams', 'permit', 'survey', 'site_report']) as document_type
  on conflict (workspace_id, document_type) do nothing;

  return v_workspace_id;
exception
  when unique_violation then
    raise exception '% is already added to this organisation', v_name;
end;
$$;

revoke all on function public.add_org_country_workspace(text, text) from public, anon;
grant execute on function public.add_org_country_workspace(text, text) to authenticated;

create or replace function public.get_my_country_workspace_entitlements(
  p_org_slug text,
  p_stripe_mode text default 'live'
)
returns table (
  workspace_id uuid,
  stripe_mode text,
  market_id text,
  currency text,
  billing_plan text,
  subscription_status text,
  current_period_end timestamptz,
  cancel_at_period_end boolean,
  stripe_trial_end timestamptz,
  past_due_since timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select s.workspace_id, s.stripe_mode, s.market_id, s.currency,
    s.billing_plan, s.subscription_status, s.current_period_end,
    s.cancel_at_period_end, s.stripe_trial_end, s.past_due_since
  from public.org_country_workspace_subscriptions s
  join public.org_country_workspaces w on w.id = s.workspace_id
  join public.organizations o on o.id = w.org_id
  where o.slug = p_org_slug
    and s.stripe_mode = p_stripe_mode
    and p_stripe_mode in ('live', 'test')
    and exists (
      select 1 from public.org_country_workspace_memberships wm
      where wm.workspace_id = w.id and wm.user_id = auth.uid()
    );
$$;

revoke all on function public.get_my_country_workspace_entitlements(text, text) from public, anon;
grant execute on function public.get_my_country_workspace_entitlements(text, text) to authenticated;

create or replace function public.set_org_country_workspace_member(
  p_workspace_id uuid,
  p_user_id uuid,
  p_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_is_primary boolean;
  v_target_role text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select w.org_id, w.is_primary into v_org_id, v_is_primary
  from public.org_country_workspaces w where w.id = p_workspace_id;
  if v_org_id is null or not exists (
    select 1 from public.org_memberships m
    where m.org_id = v_org_id and m.user_id = auth.uid() and m.role = 'admin'
  ) then
    raise exception 'Only organisation admins can manage country access';
  end if;

  select m.role into v_target_role
  from public.org_memberships m where m.org_id = v_org_id and m.user_id = p_user_id;
  if v_target_role is null then raise exception 'Target user is not an organisation member'; end if;
  if not p_enabled and (v_is_primary or v_target_role = 'admin') then
    raise exception 'Primary-country and administrator access cannot be removed';
  end if;

  if p_enabled then
    insert into public.org_country_workspace_memberships (workspace_id, user_id, role)
    values (
      p_workspace_id,
      p_user_id,
      case v_target_role when 'admin' then 'country_admin' when 'supervisor' then 'supervisor' else 'operative' end
    )
    on conflict (workspace_id, user_id) do update set role = excluded.role;
  else
    delete from public.org_country_workspace_memberships
    where workspace_id = p_workspace_id and user_id = p_user_id;
  end if;
end;
$$;

revoke all on function public.set_org_country_workspace_member(uuid, uuid, boolean) from public, anon;
grant execute on function public.set_org_country_workspace_member(uuid, uuid, boolean) to authenticated;

-- Country-aware gates used by the D1 sync worker. Legacy/primary data keeps the
-- existing organisation trial/subscription gate; a secondary country requires
-- both country membership and its own paid subscription.
create or replace function public.user_can_read_org_country_kv(
  p_org_slug text,
  p_data_key text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_workspace_id uuid;
  v_org_id uuid;
begin
  if p_data_key !~ '^country:[0-9a-fA-F-]{36}:' then
    return public.user_can_access_org_slug(p_org_slug);
  end if;
  begin
    v_workspace_id := split_part(p_data_key, ':', 2)::uuid;
  exception when invalid_text_representation then
    return false;
  end;

  select o.id into v_org_id
  from public.organizations o
  join public.org_country_workspaces w on w.org_id = o.id
  join public.org_country_workspace_memberships wm on wm.workspace_id = w.id
  where o.slug = p_org_slug
    and w.id = v_workspace_id
    and w.enabled
    and wm.user_id = auth.uid()
  limit 1;
  return v_org_id is not null;
end;
$$;

create or replace function public.user_can_write_org_country_kv(
  p_org_slug text,
  p_namespace text,
  p_data_key text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_workspace_id uuid;
  v_role text;
  v_status text;
  v_plan text;
  v_past_due_since timestamptz;
begin
  if p_data_key !~ '^country:[0-9a-fA-F-]{36}:' then
    return public.user_can_write_org_kv(p_org_slug, p_namespace);
  end if;
  begin
    v_workspace_id := split_part(p_data_key, ':', 2)::uuid;
  exception when invalid_text_representation then
    return false;
  end;

  select m.role, lower(coalesce(s.subscription_status, 'none')),
    lower(coalesce(s.billing_plan, '')), s.past_due_since
  into v_role, v_status, v_plan, v_past_due_since
  from public.organizations o
  join public.org_memberships m on m.org_id = o.id and m.user_id = auth.uid()
  join public.org_country_workspaces w on w.org_id = o.id and w.id = v_workspace_id and w.enabled
  join public.org_country_workspace_memberships wm on wm.workspace_id = w.id and wm.user_id = auth.uid()
  left join public.org_country_workspace_subscriptions s on s.workspace_id = w.id and s.stripe_mode = 'live'
  where o.slug = p_org_slug
  limit 1;

  if v_role is null then return false; end if;
  if not (
    (v_status in ('active', 'trialing') and v_plan in ('starter', 'team', 'business', 'enterprise', 'enterprise_plus'))
    or (v_status = 'past_due' and v_plan in ('starter', 'team', 'business', 'enterprise', 'enterprise_plus')
      and (v_past_due_since is null or now() < v_past_due_since + interval '7 days'))
  ) then
    return false;
  end if;

  if v_role in ('admin', 'supervisor') then return true; end if;
  if v_role = 'operative' and p_namespace in (
    'mysafeops_workers', 'mysafeops_projects', 'training_matrix', 'cdm_packs', 'mysafeops_timesheets'
  ) then return false; end if;
  return v_role = 'operative';
end;
$$;

create or replace function public.user_can_delete_org_country_kv(
  p_org_slug text,
  p_data_key text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_data_key !~ '^country:[0-9a-fA-F-]{36}:' then public.user_can_delete_org_kv(p_org_slug)
    else public.user_can_read_org_country_kv(p_org_slug, p_data_key)
      and public.user_can_write_org_country_kv(p_org_slug, 'country_delete', p_data_key)
      and exists (
        select 1 from public.org_memberships m
        join public.organizations o on o.id = m.org_id
        where o.slug = p_org_slug and m.user_id = auth.uid() and m.role in ('admin', 'supervisor')
      )
  end;
$$;

revoke all on function public.user_can_read_org_country_kv(text, text) from public, anon;
revoke all on function public.user_can_write_org_country_kv(text, text, text) from public, anon;
revoke all on function public.user_can_delete_org_country_kv(text, text) from public, anon;
grant execute on function public.user_can_read_org_country_kv(text, text) to authenticated;
grant execute on function public.user_can_write_org_country_kv(text, text, text) to authenticated;
grant execute on function public.user_can_delete_org_country_kv(text, text) to authenticated;

-- Legacy permit mirrors and their append-only audit originally stopped at the
-- organisation boundary. Attach every existing row to the organisation's primary
-- country and require an explicit country workspace for all new client writes.
alter table public.org_permits
  add column if not exists workspace_id uuid references public.org_country_workspaces(id) on delete cascade;
alter table public.org_permit_audit
  add column if not exists workspace_id uuid references public.org_country_workspaces(id) on delete cascade;

update public.org_permits p
set workspace_id = w.id
from public.organizations o
join public.org_country_workspaces w on w.org_id = o.id and w.is_primary
where p.workspace_id is null and o.slug = p.org_slug;

update public.org_permit_audit a
set workspace_id = w.id
from public.organizations o
join public.org_country_workspaces w on w.org_id = o.id and w.is_primary
where a.workspace_id is null and o.slug = a.org_slug;

alter table public.org_permits
  drop constraint if exists org_permits_user_org_permit;
create unique index if not exists org_permits_user_workspace_permit_uidx
  on public.org_permits (user_id, workspace_id, permit_id);
create index if not exists org_permits_workspace_updated_idx
  on public.org_permits (workspace_id, updated_at desc);
create index if not exists org_permit_audit_workspace_occurred_idx
  on public.org_permit_audit (workspace_id, occurred_at desc);

drop policy if exists "org_permits_select_member" on public.org_permits;
drop policy if exists "org_permits_insert_member" on public.org_permits;
drop policy if exists "org_permits_update_member" on public.org_permits;
drop policy if exists "org_permits_delete_member" on public.org_permits;

create policy "org_permits_select_country_member"
  on public.org_permits for select to authenticated
  using (
    (select auth.uid()) = user_id
    and workspace_id is not null
    and (select public.is_country_workspace_member(workspace_id))
    and exists (
      select 1 from public.org_country_workspaces w
      join public.organizations o on o.id = w.org_id
      where w.id = workspace_id and o.slug = org_slug and w.enabled
    )
  );

create policy "org_permits_insert_country_member"
  on public.org_permits for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and workspace_id is not null
    and (select public.is_country_workspace_member(workspace_id))
    and exists (
      select 1 from public.org_country_workspaces w
      join public.organizations o on o.id = w.org_id
      where w.id = workspace_id and o.slug = org_slug and w.enabled
    )
  );

create policy "org_permits_update_country_member"
  on public.org_permits for update to authenticated
  using (
    (select auth.uid()) = user_id
    and workspace_id is not null
    and (select public.is_country_workspace_member(workspace_id))
  )
  with check (
    (select auth.uid()) = user_id
    and workspace_id is not null
    and (select public.is_country_workspace_member(workspace_id))
    and exists (
      select 1 from public.org_country_workspaces w
      join public.organizations o on o.id = w.org_id
      where w.id = workspace_id and o.slug = org_slug and w.enabled
    )
  );

create policy "org_permits_delete_country_member"
  on public.org_permits for delete to authenticated
  using (
    (select auth.uid()) = user_id
    and workspace_id is not null
    and (select public.is_country_workspace_member(workspace_id))
  );

drop policy if exists "org_permit_audit_select_member" on public.org_permit_audit;
drop policy if exists "org_permit_audit_insert_member" on public.org_permit_audit;

create policy "org_permit_audit_select_country_member"
  on public.org_permit_audit for select to authenticated
  using (
    (select auth.uid()) = user_id
    and workspace_id is not null
    and (select public.is_country_workspace_member(workspace_id))
    and exists (
      select 1 from public.org_country_workspaces w
      join public.organizations o on o.id = w.org_id
      where w.id = workspace_id and o.slug = org_slug and w.enabled
    )
  );

create policy "org_permit_audit_insert_country_member"
  on public.org_permit_audit for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and workspace_id is not null
    and (select public.is_country_workspace_member(workspace_id))
    and exists (
      select 1 from public.org_country_workspaces w
      join public.organizations o on o.id = w.org_id
      where w.id = workspace_id and o.slug = org_slug and w.enabled
    )
  );
