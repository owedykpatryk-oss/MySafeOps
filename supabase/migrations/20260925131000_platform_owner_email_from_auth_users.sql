-- JWT email claim can be empty. Fall back to auth.users so the allowlisted owner
-- is still recognised and is not pushed into the ended-trial read-only gate.

insert into public.platform_owner_email_allowlist (email)
values ('owedykpatryk@gmail.com')
on conflict (email) do nothing;

create or replace function public.user_is_platform_owner()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text;
  v_ok boolean;
begin
  v_email := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  if v_email = '' then
    select lower(trim(coalesce(u.email, '')))
      into v_email
      from auth.users u
      where u.id = auth.uid();
  end if;
  if v_email is null or v_email = '' then
    return false;
  end if;
  select exists (
    select 1 from public.platform_owner_email_allowlist e where e.email = v_email
  ) into v_ok;
  return coalesce(v_ok, false);
end;
$$;
