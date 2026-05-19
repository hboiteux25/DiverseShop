alter table public.profiles
add column if not exists email text;

create index if not exists idx_profiles_email
on public.profiles (lower(email));

create or replace function app_private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, name, email, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1), 'Usuário'),
    new.email,
    case
      when lower(new.email) = 'henriqueboiteux62@gmail.com' then 'admin'
      when new.raw_app_meta_data ->> 'role' = 'admin' then 'admin'
      else 'operator'
    end
  )
  on conflict (id) do update
  set email = excluded.email;

  return new;
end;
$$;

update public.profiles
set email = auth.users.email
from auth.users
where profiles.id = auth.users.id
  and profiles.email is null;
