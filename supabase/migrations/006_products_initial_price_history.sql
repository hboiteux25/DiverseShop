create or replace function app_private.record_initial_price_history()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
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
    null,
    new.purchase_price,
    null,
    new.sale_price,
    auth.uid()
  );

  return new;
end;
$$;

drop trigger if exists products_record_initial_price_history on public.products;

create trigger products_record_initial_price_history
after insert on public.products
for each row
execute function app_private.record_initial_price_history();
