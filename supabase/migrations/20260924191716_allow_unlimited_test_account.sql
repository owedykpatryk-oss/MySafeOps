-- Keep the dedicated QA login outside normal trial and subscription limits.
-- Platform-owner status is resolved server-side by user_is_platform_owner();
-- no privileged email is embedded in the client bundle.
insert into public.platform_owner_email_allowlist (email)
values ('owedykpatryk@gmail.com')
on conflict (email) do nothing;
