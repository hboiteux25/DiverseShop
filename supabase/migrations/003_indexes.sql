create index if not exists products_barcode_idx
on public.products (barcode)
where barcode is not null;

create index if not exists products_description_fts_idx
on public.products
using gin (to_tsvector('portuguese', coalesce(description, '')));

create index if not exists products_status_idx
on public.products (status);

create index if not exists sale_items_product_id_idx
on public.sale_items (product_id);

create index if not exists sales_created_at_idx
on public.sales (created_at desc);

create index if not exists stock_movements_product_id_created_at_idx
on public.stock_movements (product_id, created_at desc);

create index if not exists stock_movements_created_by_idx
on public.stock_movements (created_by);

create index if not exists sales_created_by_idx
on public.sales (created_by);

create index if not exists cash_closings_date_idx
on public.cash_closings (date desc);

create index if not exists price_history_product_id_created_at_idx
on public.price_history (product_id, created_at desc);
