create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cpf text not null,
  phone text,
  email text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_name_not_blank check (length(trim(name)) >= 2),
  constraint customers_cpf_digits check (cpf ~ '^[0-9]{11}$'),
  constraint customers_phone_digits check (phone is null or phone ~ '^[0-9]{10,11}$'),
  constraint customers_email_format check (
    email is null
    or email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
  )
);

create unique index if not exists customers_cpf_active_unique
on public.customers (cpf)
where deleted_at is null;

create index if not exists customers_name_idx
on public.customers using btree (lower(name));

create index if not exists customers_phone_idx
on public.customers (phone)
where phone is not null;

alter table public.sales
add column if not exists customer_id uuid references public.customers(id) on delete set null;

create index if not exists sales_customer_id_idx
on public.sales (customer_id)
where customer_id is not null;

drop trigger if exists customers_set_updated_at on public.customers;
create trigger customers_set_updated_at
before update on public.customers
for each row
execute function app_private.set_updated_at();

alter table public.customers enable row level security;

revoke all on public.customers from anon, authenticated;
grant select, insert, update on public.customers to authenticated;

create policy "Staff can read customers"
on public.customers
for select
to authenticated
using (app_private.is_staff());

create policy "Staff can create customers"
on public.customers
for insert
to authenticated
with check (app_private.is_staff());

create policy "Staff can update customers"
on public.customers
for update
to authenticated
using (app_private.is_staff())
with check (app_private.is_staff());

drop function if exists public.create_sale_atomic(jsonb, text, numeric, numeric, jsonb);

create or replace function public.create_sale_atomic(
  p_items jsonb,
  p_payment_method text,
  p_discount numeric default 0,
  p_card_fee_rate numeric default null,
  p_payment_details jsonb default '{}'::jsonb,
  p_customer_id uuid default null
)
returns public.sales
language plpgsql
security definer
set search_path = public, app_private, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  current_role text;
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
    raise exception 'Usuário não autenticado.';
  end if;

  select profiles.role
  into current_role
  from public.profiles
  where profiles.id = current_user_id;

  if current_role not in ('admin', 'operator') then
    raise exception 'Usuário sem permissão para criar vendas.';
  end if;

  if p_customer_id is not null and not exists (
    select 1
    from public.customers
    where customers.id = p_customer_id
      and customers.deleted_at is null
  ) then
    raise exception 'Cliente não encontrado ou inativo.';
  end if;

  if p_payment_method not in ('cash', 'pix', 'credit_card', 'debit_card', 'mixed') then
    raise exception 'Forma de pagamento inválida.';
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
      raise exception 'Item inválido na venda.';
    end if;

    select products.stock_quantity
    into available_stock
    from public.products
    where products.id = item_product_id
      and products.deleted_at is null
    for update;

    if available_stock is null then
      raise exception 'Produto não encontrado.';
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
    raise exception 'Desconto inválido para a venda.';
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
      raise exception 'Valores do pagamento misto não fecham com o total.';
    end if;
  end if;

  if effective_card_fee_rate < 0 then
    raise exception 'Taxa de cartão inválida.';
  end if;

  net_received := final_total - (card_base * effective_card_fee_rate);

  insert into public.sales (
    total,
    discount,
    payment_method,
    card_fee_rate,
    net_received,
    payment_details,
    customer_id,
    created_by
  )
  values (
    subtotal,
    total_discount,
    p_payment_method,
    case when card_base > 0 then effective_card_fee_rate else null end,
    net_received,
    coalesce(p_payment_details, '{}'::jsonb),
    p_customer_id,
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

revoke all on function public.create_sale_atomic(jsonb, text, numeric, numeric, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.create_sale_atomic(jsonb, text, numeric, numeric, jsonb, uuid) to authenticated;

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
  ('clientes', '/clientes', 'Clientes', 'Cadastro, busca e histórico de clientes da loja.', 'users', 85, true, 'operator'),
  ('clientes.id', '/clientes/[id]', 'Detalhes do cliente', 'Histórico de compras e edição de dados do cliente.', 'users', 86, false, 'operator')
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
where app_screens.id in ('clientes', 'clientes.id')
on conflict (role, screen_id) do nothing;
