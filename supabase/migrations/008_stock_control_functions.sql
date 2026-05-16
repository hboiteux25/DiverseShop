create or replace function public.register_stock_entry(
  p_product_id uuid,
  p_quantity integer,
  p_reason text default null,
  p_box_number integer default null,
  p_supplier_id uuid default null,
  p_purchase_price numeric default null
)
returns public.products
language plpgsql
security definer
set search_path = public, app_private, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  current_role text;
  updated_product public.products;
begin
  if current_user_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  select profiles.role
  into current_role
  from public.profiles
  where profiles.id = current_user_id;

  if current_role not in ('admin', 'operator') then
    raise exception 'Usuário sem permissão para registrar estoque.';
  end if;

  if p_quantity <= 0 then
    raise exception 'Quantidade deve ser maior que zero.';
  end if;

  update public.products
  set
    box_number = coalesce(p_box_number, box_number),
    supplier_id = coalesce(p_supplier_id, supplier_id),
    purchase_price = coalesce(p_purchase_price, purchase_price)
  where id = p_product_id
    and deleted_at is null
  returning * into updated_product;

  if updated_product.id is null then
    raise exception 'Produto não encontrado.';
  end if;

  insert into public.stock_movements (product_id, type, quantity, reason, created_by)
  values (
    p_product_id,
    'in',
    p_quantity,
    coalesce(nullif(trim(p_reason), ''), 'Entrada de mercadoria'),
    current_user_id
  );

  select *
  into updated_product
  from public.products
  where id = p_product_id;

  return updated_product;
end;
$$;

create or replace function public.adjust_product_stock(
  p_product_id uuid,
  p_new_quantity integer,
  p_reason text
)
returns public.products
language plpgsql
security definer
set search_path = public, app_private, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  current_role text;
  current_quantity integer;
  quantity_delta integer;
  updated_product public.products;
begin
  if current_user_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  select profiles.role
  into current_role
  from public.profiles
  where profiles.id = current_user_id;

  if current_role <> 'admin' then
    raise exception 'Apenas administradores podem ajustar estoque manualmente.';
  end if;

  if p_new_quantity < 0 then
    raise exception 'Novo estoque não pode ser negativo.';
  end if;

  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'Justificativa obrigatória.';
  end if;

  select stock_quantity
  into current_quantity
  from public.products
  where id = p_product_id
    and deleted_at is null
  for update;

  if current_quantity is null then
    raise exception 'Produto não encontrado.';
  end if;

  quantity_delta := p_new_quantity - current_quantity;

  if quantity_delta <> 0 then
    insert into public.stock_movements (product_id, type, quantity, reason, created_by)
    values (p_product_id, 'adjustment', quantity_delta, trim(p_reason), current_user_id);
  end if;

  select *
  into updated_product
  from public.products
  where id = p_product_id;

  return updated_product;
end;
$$;

revoke all on function public.register_stock_entry(uuid, integer, text, integer, uuid, numeric) from public, anon, authenticated;
revoke all on function public.adjust_product_stock(uuid, integer, text) from public, anon, authenticated;

grant execute on function public.register_stock_entry(uuid, integer, text, integer, uuid, numeric) to authenticated;
grant execute on function public.adjust_product_stock(uuid, integer, text) to authenticated;

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then
    alter publication supabase_realtime add table public.stock_movements;
  end if;
exception
  when duplicate_object then null;
end;
$$;
