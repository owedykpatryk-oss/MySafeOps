-- Track invite email delivery lifecycle for admin transparency.

alter table public.org_invites
  add column if not exists email_delivery_status text not null default 'pending',
  add column if not exists email_delivery_error text,
  add column if not exists email_delivery_attempted_at timestamptz,
  add column if not exists email_delivery_sent_at timestamptz;

alter table public.org_invites
  drop constraint if exists org_invites_email_delivery_status_check;

alter table public.org_invites
  add constraint org_invites_email_delivery_status_check
  check (email_delivery_status in ('pending', 'sent', 'skipped', 'failed'));

update public.org_invites
set email_delivery_status = 'pending'
where email_delivery_status is null;

create index if not exists org_invites_email_delivery_status_idx
  on public.org_invites (email_delivery_status);

comment on column public.org_invites.email_delivery_status is
  'Invite email delivery state: pending | sent | skipped | failed';
comment on column public.org_invites.email_delivery_error is
  'Latest email provider error detail (if skipped/failed)';
comment on column public.org_invites.email_delivery_attempted_at is
  'Timestamp of latest outbound email attempt';
comment on column public.org_invites.email_delivery_sent_at is
  'Timestamp when invite email was accepted by provider';
