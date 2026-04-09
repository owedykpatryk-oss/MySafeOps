-- Query-performance indexes for cloud permit audit filters.
create index if not exists org_permit_audit_user_org_occurred_idx
  on public.org_permit_audit (user_id, org_slug, occurred_at desc);

create index if not exists org_permit_audit_user_org_action_occurred_idx
  on public.org_permit_audit (user_id, org_slug, action, occurred_at desc);
