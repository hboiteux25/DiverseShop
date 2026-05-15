create or replace function app_private.current_user_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select profiles.role
  from public.profiles
  where profiles.id = (select auth.uid())
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

create or replace function app_private.prevent_profile_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.role is distinct from new.role and not app_private.is_admin() then
    raise exception 'Apenas administradores podem alterar permissões.';
  end if;

  return new;
end;
$$;

alter table public.suppliers enable row level security;
alter table public.products enable row level security;
alter table public.stock_movements enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.cash_closings enable row level security;
alter table public.profiles enable row level security;
alter table public.price_history enable row level security;

revoke all on public.suppliers from anon, authenticated;
revoke all on public.products from anon, authenticated;
revoke all on public.stock_movements from anon, authenticated;
revoke all on public.sales from anon, authenticated;
revoke all on public.sale_items from anon, authenticated;
revoke all on public.cash_closings from anon, authenticated;
revoke all on public.profiles from anon, authenticated;
revoke all on public.price_history from anon, authenticated;

revoke all on all routines in schema app_private from public, anon, authenticated;

grant usage on schema public to authenticated;
grant usage on schema app_private to authenticated;

grant select, insert, update, delete on public.suppliers to authenticated;
grant select, insert, update, delete on public.products to authenticated;
grant select, insert on public.stock_movements to authenticated;
grant select, insert, update on public.sales to authenticated;
grant select, insert on public.sale_items to authenticated;
grant select, insert, update, delete on public.cash_closings to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select on public.price_history to authenticated;

grant execute on function app_private.current_user_role() to authenticated;
grant execute on function app_private.is_admin() to authenticated;
grant execute on function app_private.is_staff() to authenticated;

drop trigger if exists profiles_prevent_role_escalation on public.profiles;
create trigger profiles_prevent_role_escalation
before update of role on public.profiles
for each row
execute function app_private.prevent_profile_role_escalation();

create policy "Authenticated users can read suppliers"
on public.suppliers
for select
to authenticated
using ((select auth.uid()) is not null);

create policy "Admins can manage suppliers"
on public.suppliers
for all
to authenticated
using (app_private.is_admin())
with check (app_private.is_admin());

create policy "Authenticated users can read products"
on public.products
for select
to authenticated
using ((select auth.uid()) is not null);

create policy "Admins can manage products and prices"
on public.products
for all
to authenticated
using (app_private.is_admin())
with check (app_private.is_admin());

create policy "Staff can read stock movements"
on public.stock_movements
for select
to authenticated
using (app_private.is_staff());

create policy "Staff can create stock movements"
on public.stock_movements
for insert
to authenticated
with check (
  app_private.is_staff()
  and created_by = (select auth.uid())
);

create policy "Admins can read all sales"
on public.sales
for select
to authenticated
using (app_private.is_admin());

create policy "Staff can read their own sales"
on public.sales
for select
to authenticated
using (created_by = (select auth.uid()) and app_private.is_staff());

create policy "Staff can create sales"
on public.sales
for insert
to authenticated
with check (
  app_private.is_staff()
  and created_by = (select auth.uid())
  and status = 'completed'
);

create policy "Admins can update sales to cancel"
on public.sales
for update
to authenticated
using (app_private.is_admin())
with check (app_private.is_admin());

create policy "Admins can read all sale items"
on public.sale_items
for select
to authenticated
using (app_private.is_admin());

create policy "Staff can read items from their own sales"
on public.sale_items
for select
to authenticated
using (
  app_private.is_staff()
  and exists (
    select 1
    from public.sales
    where sales.id = sale_items.sale_id
      and sales.created_by = (select auth.uid())
  )
);

create policy "Staff can create sale items for their own sales"
on public.sale_items
for insert
to authenticated
with check (
  app_private.is_staff()
  and exists (
    select 1
    from public.sales
    where sales.id = sale_items.sale_id
      and sales.created_by = (select auth.uid())
      and sales.status = 'completed'
  )
);

create policy "Admins can manage cash closings"
on public.cash_closings
for all
to authenticated
using (app_private.is_admin())
with check (app_private.is_admin());

create policy "Users can read their own profile"
on public.profiles
for select
to authenticated
using (id = (select auth.uid()));

create policy "Admins can read profiles"
on public.profiles
for select
to authenticated
using (app_private.is_admin());

create policy "Users can create their own profile"
on public.profiles
for insert
to authenticated
with check (id = (select auth.uid()));

create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy "Admins can update profiles"
on public.profiles
for update
to authenticated
using (app_private.is_admin())
with check (app_private.is_admin());

create policy "Admins can read price history"
on public.price_history
for select
to authenticated
using (app_private.is_admin());
