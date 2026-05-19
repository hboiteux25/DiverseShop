alter table public.profiles disable trigger profiles_prevent_role_escalation;

update public.profiles
set role = 'admin'
where lower(email) = 'henriqueboiteux62@gmail.com'
  and name = 'Henrique';

alter table public.profiles enable trigger profiles_prevent_role_escalation;
