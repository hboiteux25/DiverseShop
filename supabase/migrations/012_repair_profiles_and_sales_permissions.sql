alter table public.profiles
add column if not exists email text;

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
  coalesce(nullif(users.raw_user_meta_data ->> 'name', ''), split_part(users.email, '@', 1), 'Usuário'),
  users.email,
  case
    when lower(users.email) = 'henriqueboiteux62@gmail.com' then 'admin'
    when users.raw_app_meta_data ->> 'role' = 'admin' then 'admin'
    else 'operator'
  end
from auth.users
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

update public.profiles
set role = 'admin'
where lower(email) = 'henriqueboiteux62@gmail.com';

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

  current_role := app_private.current_user_role();

  if current_role not in ('admin', 'operator') then
    raise exception 'Usuário sem permissão para criar vendas.';
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
