-- Rate-limit log for the send-permit-notification edge function. Written only by the
-- function's service-role client; no role gets direct access (mirrors
-- stripe_webhook_failures). Prevents an authenticated org member from using the
-- notification relay to blast large volumes of email.

create table if not exists public.permit_notification_log (
  id bigserial primary key,
  user_id uuid not null references auth.users on delete cascade,
  org_id uuid,
  recipient_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists permit_notification_log_user_created_idx
  on public.permit_notification_log (user_id, created_at desc);

alter table public.permit_notification_log enable row level security;

drop policy if exists permit_notification_log_no_access on public.permit_notification_log;
create policy permit_notification_log_no_access
  on public.permit_notification_log
  for all
  to public
  using (false)
  with check (false);

comment on table public.permit_notification_log is
  'Send history for permit email notifications, used to rate-limit send-permit-notification. Service-role only.';
