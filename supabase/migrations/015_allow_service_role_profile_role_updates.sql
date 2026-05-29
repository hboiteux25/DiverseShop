create or replace function app_private.is_service_role_request()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    auth.role() = 'service_role'
    or current_setting('request.jwt.claim.role', true) = 'service_role'
    or current_setting('request.jwt.claims', true)::jsonb ->> 'role' = 'service_role',
    false
  )
$$;

create or replace function app_private.prevent_profile_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.role is distinct from new.role
    and not (
      app_private.is_service_role_request()
      or app_private.is_admin()
    )
  then
    raise exception 'Apenas administradores podem alterar permissoes.';
  end if;

  return new;
end;
$$;

grant execute on function app_private.is_service_role_request() to authenticated;
