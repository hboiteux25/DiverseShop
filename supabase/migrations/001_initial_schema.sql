create extension if not exists pgcrypto;

create schema if not exists app_private;

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact text,
  delivery_days integer,
  created_at timestamptz not null default now(),
  constraint suppliers_name_not_blank check (length(trim(name)) > 0),
  constraint suppliers_delivery_days_non_negative check (delivery_days is null or delivery_days >= 0)
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  barcode text unique,
  description text not null,
  box_number integer,
  supplier_id uuid references public.suppliers(id) on delete restrict,
  purchase_price numeric(10, 2) not null,
  sale_price numeric(10, 2) not null,
  stock_quantity integer not null default 0,
  min_stock integer not null default 2,
  status text generated always as (
    case
      when stock_quantity = 0 then 'out_of_stock'
      when stock_quantity <= min_stock then 'low_stock'
      else 'in_stock'
    end
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_description_not_blank check (length(trim(description)) > 0),
  constraint products_box_number_positive check (box_number is null or box_number > 0),
  constraint products_purchase_price_positive check (purchase_price > 0),
  constraint products_sale_price_positive check (sale_price > 0),
  constraint products_stock_quantity_non_negative check (stock_quantity >= 0),
  constraint products_min_stock_non_negative check (min_stock >= 0)
);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  type text not null check (type in ('in', 'out', 'adjustment')),
  quantity integer not null,
  reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint stock_movements_quantity_valid check (
    (type in ('in', 'out') and quantity > 0)
    or (type = 'adjustment' and quantity <> 0)
  )
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  total numeric(10, 2) not null,
  discount numeric(10, 2) not null default 0,
  payment_method text not null check (payment_method in ('cash', 'pix', 'credit_card', 'debit_card', 'mixed')),
  card_fee_rate numeric(5, 4),
  net_received numeric(10, 2) not null,
  status text not null default 'completed' check (status in ('completed', 'cancelled')),
  cancel_reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint sales_total_non_negative check (total >= 0),
  constraint sales_discount_non_negative check (discount >= 0),
  constraint sales_discount_not_greater_than_total check (discount <= total),
  constraint sales_card_fee_rate_non_negative check (card_fee_rate is null or card_fee_rate >= 0),
  constraint sales_net_received_non_negative check (net_received >= 0),
  constraint sales_cancel_reason_required check (
    status = 'completed'
    or nullif(trim(coalesce(cancel_reason, '')), '') is not null
  )
);

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null,
  unit_price numeric(10, 2) not null,
  discount numeric(10, 2) not null default 0,
  constraint sale_items_quantity_positive check (quantity > 0),
  constraint sale_items_unit_price_positive check (unit_price > 0),
  constraint sale_items_discount_non_negative check (discount >= 0),
  constraint sale_items_discount_not_greater_than_line_total check (discount <= quantity * unit_price)
);

create table if not exists public.cash_closings (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  expected_cash numeric(10, 2),
  counted_cash numeric(10, 2),
  difference numeric(10, 2) generated always as (counted_cash - expected_cash) stored,
  total_sales numeric(10, 2),
  total_pix numeric(10, 2),
  total_credit numeric(10, 2),
  total_debit numeric(10, 2),
  total_discount numeric(10, 2),
  total_card_fees numeric(10, 2),
  notes text,
  closed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint cash_closings_expected_cash_non_negative check (expected_cash is null or expected_cash >= 0),
  constraint cash_closings_counted_cash_non_negative check (counted_cash is null or counted_cash >= 0),
  constraint cash_closings_total_sales_non_negative check (total_sales is null or total_sales >= 0),
  constraint cash_closings_total_pix_non_negative check (total_pix is null or total_pix >= 0),
  constraint cash_closings_total_credit_non_negative check (total_credit is null or total_credit >= 0),
  constraint cash_closings_total_debit_non_negative check (total_debit is null or total_debit >= 0),
  constraint cash_closings_total_discount_non_negative check (total_discount is null or total_discount >= 0),
  constraint cash_closings_total_card_fees_non_negative check (total_card_fees is null or total_card_fees >= 0)
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  role text not null default 'operator' check (role in ('admin', 'operator')),
  created_at timestamptz not null default now(),
  constraint profiles_name_not_blank check (length(trim(name)) > 0)
);

create table if not exists public.price_history (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  old_purchase_price numeric(10, 2),
  new_purchase_price numeric(10, 2),
  old_sale_price numeric(10, 2),
  new_sale_price numeric(10, 2),
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

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

create or replace function app_private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, name, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1), 'Usuário'),
    case
      when new.raw_app_meta_data ->> 'role' = 'admin' then 'admin'
      else 'operator'
    end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create or replace function app_private.record_price_history()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.purchase_price is distinct from new.purchase_price
    or old.sale_price is distinct from new.sale_price then
    insert into public.price_history (
      product_id,
      old_purchase_price,
      new_purchase_price,
      old_sale_price,
      new_sale_price,
      changed_by
    )
    values (
      new.id,
      old.purchase_price,
      new.purchase_price,
      old.sale_price,
      new.sale_price,
      auth.uid()
    );
  end if;

  return new;
end;
$$;

create or replace function app_private.apply_stock_movement()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  quantity_delta integer;
  resulting_stock integer;
begin
  quantity_delta := case new.type
    when 'in' then new.quantity
    when 'out' then -new.quantity
    else new.quantity
  end;

  update public.products
  set stock_quantity = stock_quantity + quantity_delta
  where id = new.product_id
  returning stock_quantity into resulting_stock;

  if resulting_stock is null then
    raise exception 'Produto não encontrado.';
  end if;

  if resulting_stock < 0 then
    raise exception 'Estoque insuficiente para concluir a movimentação.';
  end if;

  return new;
end;
$$;

create or replace function app_private.create_sale_item_stock_movement()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  sale_created_by uuid;
begin
  select created_by
  into sale_created_by
  from public.sales
  where id = new.sale_id;

  insert into public.stock_movements (product_id, type, quantity, reason, created_by)
  values (
    new.product_id,
    'out',
    new.quantity,
    'Venda ' || new.sale_id::text,
    sale_created_by
  );

  return new;
end;
$$;

create or replace function app_private.restore_stock_on_sale_cancellation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.status = 'completed' and new.status = 'cancelled' then
    insert into public.stock_movements (product_id, type, quantity, reason, created_by)
    select
      sale_items.product_id,
      'in',
      sale_items.quantity,
      'Cancelamento da venda ' || new.id::text,
      new.created_by
    from public.sale_items
    where sale_items.sale_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
before update on public.products
for each row
execute function app_private.set_updated_at();

drop trigger if exists auth_users_handle_new_user on auth.users;
create trigger auth_users_handle_new_user
after insert on auth.users
for each row
execute function app_private.handle_new_user();

drop trigger if exists products_record_price_history on public.products;
create trigger products_record_price_history
after update of purchase_price, sale_price on public.products
for each row
execute function app_private.record_price_history();

drop trigger if exists stock_movements_apply_stock_movement on public.stock_movements;
create trigger stock_movements_apply_stock_movement
after insert on public.stock_movements
for each row
execute function app_private.apply_stock_movement();

drop trigger if exists sale_items_create_stock_movement on public.sale_items;
create trigger sale_items_create_stock_movement
after insert on public.sale_items
for each row
execute function app_private.create_sale_item_stock_movement();

drop trigger if exists sales_restore_stock_on_cancellation on public.sales;
create trigger sales_restore_stock_on_cancellation
after update of status on public.sales
for each row
execute function app_private.restore_stock_on_sale_cancellation();
