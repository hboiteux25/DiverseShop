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

create table if not exists public.role_screen_permissions (
  role text not null check (role in ('operator')),
  screen_id text not null references public.app_screens(id) on delete cascade,
  can_access boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (role, screen_id)
);

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

alter table public.app_screens enable row level security;
alter table public.role_screen_permissions enable row level security;

revoke all on public.app_screens from anon, authenticated;
revoke all on public.role_screen_permissions from anon, authenticated;

grant select, insert, update, delete on public.app_screens to authenticated;
grant select, insert, update, delete on public.role_screen_permissions to authenticated;

create policy "Staff can read app screens"
on public.app_screens
for select
to authenticated
using (app_private.is_staff());

create policy "Admins can manage app screens"
on public.app_screens
for all
to authenticated
using (app_private.is_admin())
with check (app_private.is_admin());

create policy "Admins can read screen permissions"
on public.role_screen_permissions
for select
to authenticated
using (app_private.is_admin());

create policy "Operators can read their screen permissions"
on public.role_screen_permissions
for select
to authenticated
using (
  role = 'operator'
  and app_private.current_user_role() = 'operator'
);

create policy "Admins can manage screen permissions"
on public.role_screen_permissions
for all
to authenticated
using (app_private.is_admin())
with check (app_private.is_admin());

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
  ('dashboard', '/', 'Dashboard', 'Visão geral de vendas, estoque e indicadores da loja.', 'home', 10, true, 'admin'),
  ('vendas', '/vendas', 'Vendas', 'Ponto de venda para registrar compras e pagamentos.', 'shopping-cart', 20, true, 'operator'),
  ('vendas.historico', '/vendas/historico', 'Histórico de vendas', 'Consulta do histórico de vendas registradas no sistema.', 'shopping-cart', 30, false, 'operator'),
  ('produtos', '/produtos', 'Produtos', 'Lista, busca e manutenção dos produtos cadastrados.', 'package', 40, true, 'admin'),
  ('produtos.novo', '/produtos/novo', 'Novo produto', 'Cadastro de novos produtos no estoque.', 'package', 50, false, 'admin'),
  ('produtos.id', '/produtos/[id]', 'Editar produto', 'Edição dos dados e preços de um produto.', 'package', 60, false, 'admin'),
  ('estoque', '/estoque', 'Estoque', 'Controle de entradas, ajustes e alertas de estoque.', 'boxes', 70, true, 'admin'),
  ('fornecedores', '/fornecedores', 'Fornecedores', 'Cadastro e manutenção de fornecedores.', 'clipboard', 80, true, 'admin'),
  ('caixa', '/caixa', 'Caixa', 'Fechamento de caixa e conciliação dos recebimentos.', 'cash', 90, true, 'admin'),
  ('relatorios', '/relatorios', 'Relatórios', 'Relatórios financeiros e operacionais.', 'chart', 100, true, 'admin'),
  ('chat', '/chat', 'Assistente IA', 'Assistente para cadastro, consultas e sugestões de reposição.', 'bot', 110, true, 'admin'),
  ('usuarios', '/usuarios', 'Permissões', 'Controle de usuários, perfis e acesso por tela.', 'shield', 120, true, 'admin')
on conflict (id) do update set
  route_path = excluded.route_path,
  title = excluded.title,
  description = excluded.description,
  icon_name = excluded.icon_name,
  sort_order = excluded.sort_order,
  show_in_navigation = excluded.show_in_navigation,
  default_access = excluded.default_access;

insert into public.role_screen_permissions (role, screen_id, can_access)
select 'operator', app_screens.id, app_screens.default_access = 'operator'
from public.app_screens
on conflict (role, screen_id) do nothing;
