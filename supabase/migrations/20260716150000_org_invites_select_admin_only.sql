-- Invite tokens must not be readable by every org member (operative scrape risk).
-- Preview/accept still uses security-definer RPC get_invite_preview / ensure_my_org.
-- Align SELECT with insert/update: org admin only.

drop policy if exists "org_invites_select_org_members" on public.org_invites;
drop policy if exists "org_invites_select_org_admin" on public.org_invites;

create policy "org_invites_select_org_admin"
  on public.org_invites for select
  using (
    exists (
      select 1
      from public.org_memberships m
      where m.org_id = org_invites.org_id
        and m.user_id = (select auth.uid())
        and m.role = 'admin'
    )
  );
