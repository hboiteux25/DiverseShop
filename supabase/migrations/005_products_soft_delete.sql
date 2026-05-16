alter table public.products
add column if not exists deleted_at timestamptz;

create index if not exists idx_products_deleted_at
on public.products (deleted_at)
where deleted_at is null;
