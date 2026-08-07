-- Keep emailed invite links usable after plaintext tokens are cleared.
-- The Edge function also writes the hash explicitly; this trigger is the
-- database-side fail-safe for inserts and any other token-clearing path.

create extension if not exists pgcrypto with schema extensions;

alter table public.org_invites
  alter column invite_token drop not null;

update public.org_invites
set email = lower(trim(email))
where email is distinct from lower(trim(email));

update public.org_invites
set invite_token_hash = encode(
  extensions.digest(convert_to(invite_token, 'UTF8'), 'sha256'),
  'hex'
)
where nullif(trim(coalesce(invite_token, '')), '') is not null
  and nullif(trim(coalesce(invite_token_hash, '')), '') is null;

create or replace function public.org_invites_set_token_hash()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  if nullif(trim(coalesce(new.invite_token, '')), '') is not null then
    new.invite_token_hash := encode(
      extensions.digest(convert_to(new.invite_token, 'UTF8'), 'sha256'),
      'hex'
    );
  elsif tg_op = 'UPDATE'
    and nullif(trim(coalesce(old.invite_token, '')), '') is not null then
    -- When plaintext is being cleared, always bind the hash to the token that
    -- was actually sent instead of trusting a possibly missing/stale value.
    new.invite_token_hash := encode(
      extensions.digest(convert_to(old.invite_token, 'UTF8'), 'sha256'),
      'hex'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_org_invites_token_hash on public.org_invites;
create trigger trg_org_invites_token_hash
before insert or update of invite_token on public.org_invites
for each row execute function public.org_invites_set_token_hash();

-- Only one live invite per organisation/email. Creating a replacement invite
-- revokes the older one so stale links cannot retain a previous role.
with ranked as (
  select
    id,
    row_number() over (
      partition by org_id, lower(trim(email))
      order by created_at desc, id desc
    ) as position
  from public.org_invites
  where status = 'pending'
)
update public.org_invites i
set status = 'revoked'
from ranked r
where i.id = r.id
  and r.position > 1;

create unique index if not exists org_invites_one_pending_email_idx
  on public.org_invites (org_id, lower(trim(email)))
  where status = 'pending';

create or replace function public.org_invites_normalize_email()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.email := lower(trim(new.email));
  return new;
end;
$$;

drop trigger if exists trg_org_invites_normalize_email on public.org_invites;
create trigger trg_org_invites_normalize_email
before insert or update of email on public.org_invites
for each row execute function public.org_invites_normalize_email();

create or replace function public.create_org_invite(
  p_org_id uuid,
  p_email text,
  p_role text,
  p_invite_token text,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(trim(coalesce(p_email, '')));
  v_invite_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.org_memberships m
    where m.user_id = v_uid
      and m.org_id = p_org_id
      and m.role = 'admin'
  ) then
    raise exception 'Only organisation admins can create invites.';
  end if;

  if v_email = '' or position('@' in v_email) <= 1 then
    raise exception 'Enter a valid email address.';
  end if;

  if p_role not in ('admin', 'supervisor', 'operative') then
    raise exception 'Invalid invite role.';
  end if;

  if nullif(trim(coalesce(p_invite_token, '')), '') is null then
    raise exception 'Invite token is required.';
  end if;

  if p_expires_at is null or p_expires_at <= now() then
    raise exception 'Invite expiry must be in the future.';
  end if;

  update public.org_invites
  set status = 'revoked'
  where org_id = p_org_id
    and lower(trim(email)) = v_email
    and status = 'pending';

  insert into public.org_invites (
    org_id,
    email,
    role,
    invite_token,
    invited_by,
    status,
    expires_at
  )
  values (
    p_org_id,
    v_email,
    p_role,
    p_invite_token,
    v_uid,
    'pending',
    p_expires_at
  )
  returning id into v_invite_id;

  return v_invite_id;
end;
$$;

revoke all on function public.create_org_invite(uuid, text, text, text, timestamptz) from public;
grant execute on function public.create_org_invite(uuid, text, text, text, timestamptz) to authenticated;
