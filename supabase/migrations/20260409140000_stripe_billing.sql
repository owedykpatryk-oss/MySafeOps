-- MySafeOps: Stripe subscription fields on organisations + ensure_my_org returns billing context.

alter table public.organizations
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists billing_plan text,
  add column if not exists subscription_status text not null default 'none';

alter table public.organizations
  drop constraint if exists organizations_billing_plan_check;
alter table public.organizations
  add constraint organizations_billing_plan_check
  check (billing_plan is null or billing_plan in ('starter', 'team', 'business'));

alter table public.organizations
  drop constraint if exists organizations_subscription_status_check;
alter table public.organizations
  add constraint organizations_subscription_status_check
  check (subscription_status in ('none', 'active', 'trialing', 'past_due', 'canceled', 'unpaid'));

comment on column public.organizations.stripe_customer_id is 'Stripe Customer id (cus_...)';
comment on column public.organizations.stripe_subscription_id is 'Stripe Subscription id (sub_...) when subscribed';
comment on column public.organizations.billing_plan is 'Paid tier when subscription is active: starter | team | business';
comment on column public.organizations.subscription_status is 'Stripe-linked subscription lifecycle for this organisation';

-- Replace ensure_my_org to include billing columns in the result set.
drop function if exists public.ensure_my_org();
drop function if exists public.ensure_my_org(text);
drop function if exists public.ensure_my_org(text, text);

create or replace function public.ensure_my_org(
  p_org_name text default null,
  p_invite_token text default null
)
returns table (
  org_slug text,
  org_name text,
  trial_ends_at timestamptz,
  role text,
  billing_plan text,
  subscription_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_org_id uuid;
  v_slug text;
  v_name text;
  v_invite_id uuid;
  v_invite_role text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select o.slug, o.name, o.trial_ends_at, m.role, o.billing_plan, o.subscription_status
    into org_slug, org_name, trial_ends_at, role, billing_plan, subscription_status
  from public.org_memberships m
  join public.organizations o on o.id = m.org_id
  where m.user_id = v_uid
  limit 1;

  if found then
    return next;
    return;
  end if;

  select u.email into v_email
  from auth.users u
  where u.id = v_uid;

  if nullif(trim(coalesce(p_invite_token, '')), '') is not null then
    select i.id, i.org_id, i.role
      into v_invite_id, v_org_id, v_invite_role
    from public.org_invites i
    where i.invite_token = p_invite_token
      and i.status = 'pending'
      and i.expires_at > now()
    limit 1;

    if not found then
      raise exception 'Invite token is invalid or expired.';
    end if;

    if lower((select email from public.org_invites where id = v_invite_id)) <> lower(coalesce(v_email, '')) then
      raise exception 'Invite email mismatch. Sign in with the invited email address.';
    end if;

    insert into public.org_memberships (user_id, org_id, role)
    values (v_uid, v_org_id, coalesce(v_invite_role, 'operative'))
    on conflict (user_id) do update
      set org_id = excluded.org_id,
          role = excluded.role;

    update public.org_invites
      set status = 'accepted',
          accepted_user_id = v_uid,
          accepted_at = now()
    where id = v_invite_id;

    select o.slug, o.name, o.trial_ends_at, m.role, o.billing_plan, o.subscription_status
      into org_slug, org_name, trial_ends_at, role, billing_plan, subscription_status
    from public.org_memberships m
    join public.organizations o on o.id = m.org_id
    where m.user_id = v_uid
    limit 1;

    return next;
    return;
  end if;

  select i.id, i.org_id, i.role
    into v_invite_id, v_org_id, v_invite_role
  from public.org_invites i
  where i.status = 'pending'
    and i.expires_at > now()
    and lower(i.email) = lower(coalesce(v_email, ''))
  order by i.created_at asc
  limit 1;

  if found then
    insert into public.org_memberships (user_id, org_id, role)
    values (v_uid, v_org_id, coalesce(v_invite_role, 'operative'))
    on conflict (user_id) do update
      set org_id = excluded.org_id,
          role = excluded.role;

    update public.org_invites
      set status = 'accepted',
          accepted_user_id = v_uid,
          accepted_at = now()
    where id = v_invite_id;

    select o.slug, o.name, o.trial_ends_at, m.role, o.billing_plan, o.subscription_status
      into org_slug, org_name, trial_ends_at, role, billing_plan, subscription_status
    from public.org_memberships m
    join public.organizations o on o.id = m.org_id
    where m.user_id = v_uid
    limit 1;

    return next;
    return;
  end if;

  v_slug := lower(regexp_replace(split_part(coalesce(v_email, 'org'), '@', 1), '[^a-z0-9]+', '-', 'g'));
  v_slug := trim(both '-' from v_slug);
  if v_slug = '' then
    v_slug := 'org';
  end if;
  v_slug := left(v_slug, 24) || '-' || left(replace(v_uid::text, '-', ''), 8);

  v_name := coalesce(
    nullif(trim(p_org_name), ''),
    initcap(replace(split_part(coalesce(v_email, 'my-safeops-org'), '@', 1), '.', ' ')) || ' Workspace'
  );

  insert into public.organizations (slug, name, owner_user_id)
  values (v_slug, v_name, v_uid)
  returning id, slug, name, trial_ends_at into v_org_id, org_slug, org_name, trial_ends_at;

  insert into public.org_memberships (user_id, org_id, role)
  values (v_uid, v_org_id, 'admin')
  on conflict (user_id) do update
    set org_id = excluded.org_id,
        role = excluded.role;

  role := 'admin';
  billing_plan := null;
  subscription_status := 'none';
  return next;
end;
$$;

grant execute on function public.ensure_my_org(text, text) to authenticated;

comment on function public.ensure_my_org(text, text) is
  'Returns org context including Stripe billing fields; invite token flow; else creates org with 14-day trial.';
