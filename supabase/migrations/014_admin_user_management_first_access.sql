alter table public.profiles
add column if not exists must_change_password boolean not null default false,
add column if not exists password_changed_at timestamptz;

update public.profiles
set must_change_password = false
where must_change_password is null;

create or replace function app_private.current_user_must_change_password()
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  must_change boolean;
begin
  select profiles.must_change_password
  into must_change
  from public.profiles
  where profiles.id = (select auth.uid());

  return coalesce(must_change, false);
end;
$$;

create or replace function app_private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    app_private.current_user_role() = 'admin'
    and not app_private.current_user_must_change_password(),
    false
  )
$$;

create or replace function app_private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    app_private.current_user_role() in ('admin', 'operator')
    and not app_private.current_user_must_change_password(),
    false
  )
$$;

create or replace function app_private.can_perform_action(p_action_id text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  current_role text := app_private.current_user_role();
  action_default_access text;
  permission_value boolean;
begin
  if app_private.current_user_must_change_password() then
    return false;
  end if;

  if current_role = 'admin' then
    return true;
  end if;

  if current_role is null then
    return false;
  end if;

  select app_actions.default_access
  into action_default_access
  from public.app_actions
  where app_actions.id = p_action_id;

  if action_default_access is null then
    return false;
  end if;

  select role_action_permissions.can_execute
  into permission_value
  from public.role_action_permissions
  where role_action_permissions.role = current_role
    and role_action_permissions.action_id = p_action_id;

  return coalesce(permission_value, action_default_access = 'operator');
end;
$$;

create or replace function app_private.can_access_screen(p_route_path text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  current_role text := app_private.current_user_role();
  normalized_route text := case
    when nullif(trim(coalesce(p_route_path, '')), '') is null then '/'
    when trim(p_route_path) = '/dashboard' then '/'
    else regexp_replace(trim(p_route_path), '/+$', '')
  end;
  screen_default_access text;
  screen_identifier text;
  permission_value boolean;
begin
  if app_private.current_user_must_change_password() then
    return false;
  end if;

  if current_role = 'admin' then
    return true;
  end if;

  if current_role is null then
    return false;
  end if;

  if normalized_route = '' then
    normalized_route := '/';
  end if;

  select app_screens.id, app_screens.default_access
  into screen_identifier, screen_default_access
  from public.app_screens
  where app_screens.route_path = normalized_route;

  if screen_identifier is null then
    return false;
  end if;

  select role_screen_permissions.can_access
  into permission_value
  from public.role_screen_permissions
  where role_screen_permissions.role = current_role
    and role_screen_permissions.screen_id = screen_identifier;

  return coalesce(permission_value, screen_default_access = 'operator');
end;
$$;

create or replace function app_private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, name, email, role, must_change_password)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1), 'Usuario'),
    new.email,
    case
      when lower(new.email) = 'henriqueboiteux62@gmail.com' then 'admin'
      when new.raw_app_meta_data ->> 'role' = 'admin' then 'admin'
      else 'operator'
    end,
    coalesce((new.raw_app_meta_data ->> 'must_change_password')::boolean, true)
  )
  on conflict (id) do update
  set
    email = excluded.email,
    must_change_password = public.profiles.must_change_password;

  return new;
end;
$$;

grant execute on function app_private.current_user_must_change_password() to authenticated;
grant execute on function app_private.is_admin() to authenticated;
grant execute on function app_private.is_staff() to authenticated;
grant execute on function app_private.can_perform_action(text) to authenticated;
grant execute on function app_private.can_access_screen(text) to authenticated;
