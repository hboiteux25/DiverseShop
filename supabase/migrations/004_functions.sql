create or replace function public.get_daily_summary(p_summary_date date)
returns table (
  summary_date date,
  total_sales numeric,
  total_discount numeric,
  total_card_fees numeric,
  total_net_received numeric,
  cash_total numeric,
  pix_total numeric,
  credit_card_total numeric,
  debit_card_total numeric,
  mixed_total numeric,
  sales_count bigint,
  cancelled_sales_count bigint
)
language plpgsql
stable
set search_path = public, pg_temp
as $$
begin
  if not app_private.is_admin() then
    raise exception 'Acesso permitido apenas para administradores.';
  end if;

  return query
  select
    p_summary_date,
    coalesce(sum(sales.total) filter (where sales.status = 'completed'), 0)::numeric(10, 2),
    coalesce(sum(sales.discount) filter (where sales.status = 'completed'), 0)::numeric(10, 2),
    coalesce(sum((sales.total - sales.discount) * coalesce(sales.card_fee_rate, 0)) filter (where sales.status = 'completed'), 0)::numeric(10, 2),
    coalesce(sum(sales.net_received) filter (where sales.status = 'completed'), 0)::numeric(10, 2),
    coalesce(sum(sales.total) filter (where sales.status = 'completed' and sales.payment_method = 'cash'), 0)::numeric(10, 2),
    coalesce(sum(sales.total) filter (where sales.status = 'completed' and sales.payment_method = 'pix'), 0)::numeric(10, 2),
    coalesce(sum(sales.total) filter (where sales.status = 'completed' and sales.payment_method = 'credit_card'), 0)::numeric(10, 2),
    coalesce(sum(sales.total) filter (where sales.status = 'completed' and sales.payment_method = 'debit_card'), 0)::numeric(10, 2),
    coalesce(sum(sales.total) filter (where sales.status = 'completed' and sales.payment_method = 'mixed'), 0)::numeric(10, 2),
    count(*) filter (where sales.status = 'completed'),
    count(*) filter (where sales.status = 'cancelled')
  from public.sales
  where sales.created_at >= p_summary_date::timestamptz
    and sales.created_at < (p_summary_date + 1)::timestamptz;
end;
$$;

create or replace function public.get_monthly_summary(p_summary_year integer, p_summary_month integer)
returns table (
  summary_year integer,
  summary_month integer,
  total_sales numeric,
  total_discount numeric,
  total_card_fees numeric,
  total_net_received numeric,
  cash_total numeric,
  pix_total numeric,
  credit_card_total numeric,
  debit_card_total numeric,
  mixed_total numeric,
  sales_count bigint,
  cancelled_sales_count bigint
)
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  start_date date;
  end_date date;
begin
  if not app_private.is_admin() then
    raise exception 'Acesso permitido apenas para administradores.';
  end if;

  if p_summary_month < 1 or p_summary_month > 12 then
    raise exception 'Mês inválido.';
  end if;

  start_date := make_date(p_summary_year, p_summary_month, 1);
  end_date := (start_date + interval '1 month')::date;

  return query
  select
    p_summary_year,
    p_summary_month,
    coalesce(sum(sales.total) filter (where sales.status = 'completed'), 0)::numeric(10, 2),
    coalesce(sum(sales.discount) filter (where sales.status = 'completed'), 0)::numeric(10, 2),
    coalesce(sum((sales.total - sales.discount) * coalesce(sales.card_fee_rate, 0)) filter (where sales.status = 'completed'), 0)::numeric(10, 2),
    coalesce(sum(sales.net_received) filter (where sales.status = 'completed'), 0)::numeric(10, 2),
    coalesce(sum(sales.total) filter (where sales.status = 'completed' and sales.payment_method = 'cash'), 0)::numeric(10, 2),
    coalesce(sum(sales.total) filter (where sales.status = 'completed' and sales.payment_method = 'pix'), 0)::numeric(10, 2),
    coalesce(sum(sales.total) filter (where sales.status = 'completed' and sales.payment_method = 'credit_card'), 0)::numeric(10, 2),
    coalesce(sum(sales.total) filter (where sales.status = 'completed' and sales.payment_method = 'debit_card'), 0)::numeric(10, 2),
    coalesce(sum(sales.total) filter (where sales.status = 'completed' and sales.payment_method = 'mixed'), 0)::numeric(10, 2),
    count(*) filter (where sales.status = 'completed'),
    count(*) filter (where sales.status = 'cancelled')
  from public.sales
  where sales.created_at >= start_date::timestamptz
    and sales.created_at < end_date::timestamptz;
end;
$$;

create or replace function public.get_low_stock_products()
returns table (
  id uuid,
  barcode text,
  description text,
  box_number integer,
  supplier_id uuid,
  supplier_name text,
  sale_price numeric,
  stock_quantity integer,
  min_stock integer,
  status text
)
language sql
stable
set search_path = public, pg_temp
as $$
  select
    products.id,
    products.barcode,
    products.description,
    products.box_number,
    products.supplier_id,
    suppliers.name as supplier_name,
    products.sale_price,
    products.stock_quantity,
    products.min_stock,
    products.status
  from public.products
  left join public.suppliers on suppliers.id = products.supplier_id
  where products.stock_quantity <= products.min_stock
  order by products.stock_quantity asc, products.description asc
$$;

revoke all on function public.get_daily_summary(date) from public, anon, authenticated;
revoke all on function public.get_monthly_summary(integer, integer) from public, anon, authenticated;
revoke all on function public.get_low_stock_products() from public, anon, authenticated;

grant execute on function public.get_daily_summary(date) to authenticated;
grant execute on function public.get_monthly_summary(integer, integer) to authenticated;
grant execute on function public.get_low_stock_products() to authenticated;
