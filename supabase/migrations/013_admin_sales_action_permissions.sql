alter table public.profiles
add column if not exists email text;

alter table public.sales
add column if not exists payment_details jsonb not null default '{}'::jsonb;

create index if not exists idx_profiles_email
on public.profiles (lower(email));

create schema if not exists app_private;

create or replace function app_private.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if exists (
    select 1
    from pg_trigger
    where tgname = 'profiles_prevent_role_escalation'
      and tgrelid = 'public.profiles'::regclass
  ) then
    execute 'alter table public.profiles disable trigger profiles_prevent_role_escalation';
  end if;
end;
$$;

insert into public.profiles as profiles (id, name, email, role)
select
  users.id,
  coalesce(nullif(users.raw_user_meta_data ->> 'name', ''), split_part(users.email, '@', 1), 'Usuario'),
  users.email,
  case
    when lower(users.email) = 'henriqueboiteux62@gmail.com' then 'admin'
    when users.raw_app_meta_data ->> 'role' = 'admin' then 'admin'
    else 'operator'
  end
from auth.users
where true
on conflict (id) do update set
  email = excluded.email,
  name = case
    when length(trim(profiles.name)) = 0 then excluded.name
    else profiles.name
  end,
  role = case
    when profiles.role = 'admin' then 'admin'
    when excluded.role = 'admin' then 'admin'
    else profiles.role
  end;

do $$
begin
  if exists (
    select 1
    from pg_trigger
    where tgname = 'profiles_prevent_role_escalation'
      and tgrelid = 'public.profiles'::regclass
  ) then
    execute 'alter table public.profiles enable trigger profiles_prevent_role_escalation';
  end if;
end;
$$;

create table if not exists public.app_actions (
  id text primary key,
  area text not null,
  title text not null,
  description text not null default '',
  default_access text not null default 'admin' check (default_access in ('admin', 'operator')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_actions_id_not_blank check (length(trim(id)) > 0),
  constraint app_actions_area_not_blank check (length(trim(area)) > 0),
  constraint app_actions_title_not_blank check (length(trim(title)) > 0)
);

create table if not exists public.app_screens (
  id text primary key,
  route_path text not null unique,
  title text not null,
  description text not null default '',
  icon_name text not null default 'file',
  sort_order integer not null default 1000,
  show_in_navigation boolean not null default true,
  default_access text not null default 'admin' check (default_access in ('admin', 'operator')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_screens_id_not_blank check (length(trim(id)) > 0),
  constraint app_screens_route_path_valid check (route_path = '/' or route_path ~ '^/[^[:space:]]+'),
  constraint app_screens_title_not_blank check (length(trim(title)) > 0)
);

create table if not exists public.role_action_permissions (
  role text not null check (role in ('admin', 'operator')),
  action_id text not null references public.app_actions(id) on delete cascade,
  can_execute boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (role, action_id)
);

create table if not exists public.role_screen_permissions (
  role text not null check (role in ('admin', 'operator')),
  screen_id text not null references public.app_screens(id) on delete cascade,
  can_access boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (role, screen_id)
);

alter table public.role_screen_permissions
drop constraint if exists role_screen_permissions_role_check;

alter table public.role_screen_permissions
add constraint role_screen_permissions_role_check
check (role in ('admin', 'operator'));

create or replace function app_private.current_user_role()
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  profile_role text;
  auth_email text;
  auth_role text;
begin
  select profiles.role
  into profile_role
  from public.profiles
  where profiles.id = (select auth.uid());

  if profile_role in ('admin', 'operator') then
    return profile_role;
  end if;

  select users.email, users.raw_app_meta_data ->> 'role'
  into auth_email, auth_role
  from auth.users
  where users.id = (select auth.uid());

  if lower(coalesce(auth_email, '')) = 'henriqueboiteux62@gmail.com' or auth_role = 'admin' then
    return 'admin';
  end if;

  if (select auth.uid()) is not null then
    return 'operator';
  end if;

  return null;
end;
$$;

create or replace function app_private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(app_private.current_user_role() = 'admin', false)
$$;

create or replace function app_private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(app_private.current_user_role() in ('admin', 'operator'), false)
$$;

grant usage on schema app_private to authenticated;
grant execute on function app_private.current_user_role() to authenticated;
grant execute on function app_private.is_admin() to authenticated;
grant execute on function app_private.is_staff() to authenticated;

drop trigger if exists app_screens_set_updated_at on public.app_screens;
create trigger app_screens_set_updated_at
before update on public.app_screens
for each row
execute function app_private.set_updated_at();

drop trigger if exists role_screen_permissions_set_updated_at on public.role_screen_permissions;
create trigger role_screen_permissions_set_updated_at
before update on public.role_screen_permissions
for each row
execute function app_private.set_updated_at();

drop trigger if exists app_actions_set_updated_at on public.app_actions;
create trigger app_actions_set_updated_at
before update on public.app_actions
for each row
execute function app_private.set_updated_at();

drop trigger if exists role_action_permissions_set_updated_at on public.role_action_permissions;
create trigger role_action_permissions_set_updated_at
before update on public.role_action_permissions
for each row
execute function app_private.set_updated_at();

alter table public.app_actions enable row level security;
alter table public.role_action_permissions enable row level security;
alter table public.app_screens enable row level security;
alter table public.role_screen_permissions enable row level security;

revoke all on public.app_actions from anon, authenticated;
revoke all on public.role_action_permissions from anon, authenticated;
revoke all on public.app_screens from anon, authenticated;
revoke all on public.role_screen_permissions from anon, authenticated;

grant select, insert, update, delete on public.app_actions to authenticated;
grant select, insert, update, delete on public.role_action_permissions to authenticated;
grant select, insert, update, delete on public.app_screens to authenticated;
grant select, insert, update, delete on public.role_screen_permissions to authenticated;

drop policy if exists "Staff can read app screens" on public.app_screens;
create policy "Staff can read app screens"
on public.app_screens
for select
to authenticated
using (app_private.is_staff());

drop policy if exists "Admins can manage app screens" on public.app_screens;
create policy "Admins can manage app screens"
on public.app_screens
for all
to authenticated
using (app_private.is_admin())
with check (app_private.is_admin());

drop policy if exists "Admins can read screen permissions" on public.role_screen_permissions;
create policy "Admins can read screen permissions"
on public.role_screen_permissions
for select
to authenticated
using (app_private.is_admin());

drop policy if exists "Staff can read their screen permissions" on public.role_screen_permissions;
create policy "Staff can read their screen permissions"
on public.role_screen_permissions
for select
to authenticated
using (role = app_private.current_user_role());

drop policy if exists "Admins can manage screen permissions" on public.role_screen_permissions;
create policy "Admins can manage screen permissions"
on public.role_screen_permissions
for all
to authenticated
using (app_private.is_admin())
with check (app_private.is_admin());

drop policy if exists "Staff can read app actions" on public.app_actions;
create policy "Staff can read app actions"
on public.app_actions
for select
to authenticated
using (app_private.is_staff());

drop policy if exists "Admins can manage app actions" on public.app_actions;
create policy "Admins can manage app actions"
on public.app_actions
for all
to authenticated
using (app_private.is_admin())
with check (app_private.is_admin());

drop policy if exists "Admins can read action permissions" on public.role_action_permissions;
create policy "Admins can read action permissions"
on public.role_action_permissions
for select
to authenticated
using (app_private.is_admin());

drop policy if exists "Staff can read their action permissions" on public.role_action_permissions;
create policy "Staff can read their action permissions"
on public.role_action_permissions
for select
to authenticated
using (role = app_private.current_user_role());

drop policy if exists "Admins can manage action permissions" on public.role_action_permissions;
create policy "Admins can manage action permissions"
on public.role_action_permissions
for all
to authenticated
using (app_private.is_admin())
with check (app_private.is_admin());

create or replace function app_private.current_user_role()
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  profile_role text;
  auth_email text;
  auth_role text;
begin
  select profiles.role
  into profile_role
  from public.profiles
  where profiles.id = (select auth.uid());

  if profile_role in ('admin', 'operator') then
    return profile_role;
  end if;

  select users.email, users.raw_app_meta_data ->> 'role'
  into auth_email, auth_role
  from auth.users
  where users.id = (select auth.uid());

  if lower(coalesce(auth_email, '')) = 'henriqueboiteux62@gmail.com' or auth_role = 'admin' then
    return 'admin';
  end if;

  if (select auth.uid()) is not null then
    return 'operator';
  end if;

  return null;
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

grant execute on function app_private.current_user_role() to authenticated;
grant execute on function app_private.can_access_screen(text) to authenticated;
grant execute on function app_private.can_perform_action(text) to authenticated;

insert into public.app_screens (
  id,
  route_path,
  title,
  description,
  icon_name,
  sort_order,
  show_in_navigation,
  default_access
)
values
  ('dashboard', '/', 'Dashboard', 'Visao geral de vendas, estoque e indicadores da loja.', 'home', 10, true, 'admin'),
  ('vendas', '/vendas', 'Vendas', 'Ponto de venda para registrar compras e pagamentos.', 'shopping-cart', 20, true, 'operator'),
  ('vendas.historico', '/vendas/historico', 'Historico de vendas', 'Consulta do historico de vendas registradas no sistema.', 'shopping-cart', 30, false, 'operator'),
  ('produtos', '/produtos', 'Produtos', 'Lista, busca e manutencao dos produtos cadastrados.', 'package', 40, true, 'admin'),
  ('produtos.novo', '/produtos/novo', 'Novo produto', 'Cadastro de novos produtos no estoque.', 'package', 50, false, 'admin'),
  ('produtos.id', '/produtos/[id]', 'Editar produto', 'Edicao dos dados e precos de um produto.', 'package', 60, false, 'admin'),
  ('estoque', '/estoque', 'Estoque', 'Controle de entradas, ajustes e alertas de estoque.', 'boxes', 70, true, 'admin'),
  ('fornecedores', '/fornecedores', 'Fornecedores', 'Cadastro e manutencao de fornecedores.', 'clipboard', 80, true, 'admin'),
  ('caixa', '/caixa', 'Caixa', 'Fechamento de caixa e conciliacao dos recebimentos.', 'cash', 90, true, 'admin'),
  ('relatorios', '/relatorios', 'Relatorios', 'Relatorios financeiros e operacionais.', 'chart', 100, true, 'admin'),
  ('chat', '/chat', 'Assistente IA', 'Assistente para cadastro, consultas e sugestoes de reposicao.', 'bot', 110, true, 'admin'),
  ('usuarios', '/usuarios', 'Permissoes', 'Controle de usuarios, perfis e acesso por tela.', 'shield', 120, true, 'admin')
on conflict (id) do update set
  route_path = excluded.route_path,
  title = excluded.title,
  description = excluded.description,
  icon_name = excluded.icon_name,
  sort_order = excluded.sort_order,
  show_in_navigation = excluded.show_in_navigation,
  default_access = excluded.default_access;

insert into public.app_actions (id, area, title, description, default_access)
values
  ('sales.access', 'sales', 'Acessar vendas', 'Abrir a tela de vendas.', 'operator'),
  ('sales.create', 'sales', 'Criar vendas', 'Criar registros de venda.', 'operator'),
  ('sales.finalize', 'sales', 'Finalizar vendas', 'Concluir vendas no PDV.', 'operator'),
  ('sales.cancel', 'sales', 'Cancelar vendas', 'Cancelar vendas ja concluidas.', 'admin'),
  ('screen_permissions.manage', 'users', 'Gerenciar permissoes de tela', 'Liberar ou bloquear telas por perfil.', 'admin'),
  ('users.manage', 'users', 'Gerenciar usuarios', 'Alterar perfis de usuarios.', 'admin')
on conflict (id) do update set
  area = excluded.area,
  title = excluded.title,
  description = excluded.description,
  default_access = excluded.default_access;

insert into public.role_action_permissions (role, action_id, can_execute)
select 'admin', app_actions.id, true
from public.app_actions
where true
on conflict (role, action_id) do update set can_execute = true;

insert into public.role_action_permissions (role, action_id, can_execute)
select 'operator', app_actions.id, app_actions.default_access = 'operator'
from public.app_actions
where true
on conflict (role, action_id) do nothing;

insert into public.role_screen_permissions (role, screen_id, can_access)
select 'admin', app_screens.id, true
from public.app_screens
where true
on conflict (role, screen_id) do update set can_access = true;

insert into public.role_screen_permissions (role, screen_id, can_access)
select 'operator', app_screens.id, app_screens.default_access = 'operator'
from public.app_screens
where true
on conflict (role, screen_id) do nothing;

create or replace function public.create_sale_atomic(
  p_items jsonb,
  p_payment_method text,
  p_discount numeric default 0,
  p_card_fee_rate numeric default null,
  p_payment_details jsonb default '{}'::jsonb
)
returns public.sales
language plpgsql
security definer
set search_path = public, app_private, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  current_profile_role text;
  item jsonb;
  item_product_id uuid;
  item_quantity integer;
  item_unit_price numeric;
  item_discount numeric;
  available_stock integer;
  subtotal numeric := 0;
  item_discount_total numeric := 0;
  total_discount numeric := 0;
  final_total numeric := 0;
  effective_card_fee_rate numeric := coalesce(p_card_fee_rate, 0);
  card_base numeric := 0;
  net_received numeric := 0;
  created_sale public.sales;
begin
  if current_user_id is null then
    raise exception 'Usuario nao autenticado.';
  end if;

  current_profile_role := app_private.current_user_role();

  if current_profile_role not in ('admin', 'operator') then
    raise exception 'Usuario sem permissao para criar vendas.';
  end if;

  if not app_private.can_perform_action('sales.finalize') then
    raise exception 'Usuario sem permissao para finalizar vendas.';
  end if;

  if p_payment_method not in ('cash', 'pix', 'credit_card', 'debit_card', 'mixed') then
    raise exception 'Forma de pagamento invalida.';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Informe ao menos um item para a venda.';
  end if;

  for item in select * from jsonb_array_elements(p_items)
  loop
    item_product_id := (item ->> 'product_id')::uuid;
    item_quantity := (item ->> 'quantity')::integer;
    item_unit_price := (item ->> 'unit_price')::numeric;
    item_discount := coalesce((item ->> 'discount')::numeric, 0);

    if item_quantity <= 0 or item_unit_price <= 0 or item_discount < 0 then
      raise exception 'Item invalido na venda.';
    end if;

    select products.stock_quantity
    into available_stock
    from public.products
    where products.id = item_product_id
      and products.deleted_at is null
    for update;

    if available_stock is null then
      raise exception 'Produto nao encontrado.';
    end if;

    if available_stock < item_quantity then
      raise exception 'Estoque insuficiente para concluir a venda.';
    end if;

    if item_discount > (item_quantity * item_unit_price) then
      raise exception 'Desconto do item maior que o subtotal.';
    end if;

    subtotal := subtotal + (item_quantity * item_unit_price);
    item_discount_total := item_discount_total + item_discount;
  end loop;

  total_discount := coalesce(p_discount, 0) + item_discount_total;

  if total_discount < 0 or total_discount > subtotal then
    raise exception 'Desconto invalido para a venda.';
  end if;

  final_total := subtotal - total_discount;

  if p_payment_method in ('credit_card', 'debit_card') then
    card_base := final_total;
  elsif p_payment_method = 'mixed' then
    card_base :=
      coalesce((p_payment_details ->> 'credit_card')::numeric, 0)
      + coalesce((p_payment_details ->> 'debit_card')::numeric, 0);

    if abs((
      coalesce((p_payment_details ->> 'cash')::numeric, 0)
      + coalesce((p_payment_details ->> 'pix')::numeric, 0)
      + coalesce((p_payment_details ->> 'credit_card')::numeric, 0)
      + coalesce((p_payment_details ->> 'debit_card')::numeric, 0)
    ) - final_total) > 0.01 then
      raise exception 'Valores do pagamento misto nao fecham com o total.';
    end if;
  end if;

  if effective_card_fee_rate < 0 then
    raise exception 'Taxa de cartao invalida.';
  end if;

  net_received := final_total - (card_base * effective_card_fee_rate);

  insert into public.sales (
    total,
    discount,
    payment_method,
    card_fee_rate,
    net_received,
    payment_details,
    created_by
  )
  values (
    subtotal,
    total_discount,
    p_payment_method,
    case when card_base > 0 then effective_card_fee_rate else null end,
    net_received,
    coalesce(p_payment_details, '{}'::jsonb),
    current_user_id
  )
  returning * into created_sale;

  for item in select * from jsonb_array_elements(p_items)
  loop
    insert into public.sale_items (
      sale_id,
      product_id,
      quantity,
      unit_price,
      discount
    )
    values (
      created_sale.id,
      (item ->> 'product_id')::uuid,
      (item ->> 'quantity')::integer,
      (item ->> 'unit_price')::numeric,
      coalesce((item ->> 'discount')::numeric, 0)
    );
  end loop;

  return created_sale;
end;
$$;

revoke all on function public.create_sale_atomic(jsonb, text, numeric, numeric, jsonb) from public, anon, authenticated;
grant execute on function public.create_sale_atomic(jsonb, text, numeric, numeric, jsonb) to authenticated;
