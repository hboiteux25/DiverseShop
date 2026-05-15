insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
values (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'admin@diverseshopdf.com',
  crypt('Admin@123456', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"],"role":"admin"}',
  '{"name":"Administrador Diverse Shop"}',
  now(),
  now(),
  '',
  '',
  '',
  ''
)
on conflict (id) do nothing;

insert into public.profiles (id, name, role)
values (
  '00000000-0000-0000-0000-000000000001',
  'Administrador Diverse Shop',
  'admin'
)
on conflict (id) do update
set name = excluded.name,
    role = excluded.role;

insert into public.suppliers (id, name, contact, delivery_days)
values
  ('10000000-0000-0000-0000-000000000001', 'Papelandia', 'compras@papelandia.com.br', 5),
  ('10000000-0000-0000-0000-000000000002', 'Stabilo', 'representante@stabilo.com.br', 7),
  ('10000000-0000-0000-0000-000000000003', 'Brasfoot', 'pedidos@brasfoot.com.br', 10)
on conflict (id) do update
set name = excluded.name,
    contact = excluded.contact,
    delivery_days = excluded.delivery_days;

insert into public.products (
  id,
  barcode,
  description,
  box_number,
  supplier_id,
  purchase_price,
  sale_price,
  stock_quantity,
  min_stock
)
values
  ('20000000-0000-0000-0000-000000000001', '7891000000011', 'Caneta esferográfica azul', 1, '10000000-0000-0000-0000-000000000001', 1.20, 3.50, 24, 5),
  ('20000000-0000-0000-0000-000000000002', '7891000000028', 'Caneta esferográfica preta', 1, '10000000-0000-0000-0000-000000000001', 1.20, 3.50, 18, 5),
  ('20000000-0000-0000-0000-000000000003', '7891000000035', 'Marca-texto Stabilo amarelo', 2, '10000000-0000-0000-0000-000000000002', 4.80, 9.90, 8, 3),
  ('20000000-0000-0000-0000-000000000004', '7891000000042', 'Marca-texto Stabilo rosa', 2, '10000000-0000-0000-0000-000000000002', 4.80, 9.90, 2, 3),
  ('20000000-0000-0000-0000-000000000005', '7891000000059', 'Caderno universitário 10 matérias', 3, '10000000-0000-0000-0000-000000000001', 12.50, 24.90, 10, 4),
  ('20000000-0000-0000-0000-000000000006', '7891000000066', 'Bloco adesivo colorido', 4, '10000000-0000-0000-0000-000000000001', 3.40, 7.90, 14, 5),
  ('20000000-0000-0000-0000-000000000007', '7891000000073', 'Borracha branca macia', 5, '10000000-0000-0000-0000-000000000001', 0.80, 2.50, 30, 8),
  ('20000000-0000-0000-0000-000000000008', '7891000000080', 'Lapiseira 0.7 mm', 5, '10000000-0000-0000-0000-000000000002', 3.20, 8.50, 6, 4),
  ('20000000-0000-0000-0000-000000000009', '7891000000097', 'Chaveiro bola Brasfoot', 6, '10000000-0000-0000-0000-000000000003', 5.00, 12.90, 1, 3),
  ('20000000-0000-0000-0000-000000000010', '7891000000103', 'Mini bola decorativa Brasfoot', 6, '10000000-0000-0000-0000-000000000003', 9.50, 19.90, 0, 2)
on conflict (id) do update
set barcode = excluded.barcode,
    description = excluded.description,
    box_number = excluded.box_number,
    supplier_id = excluded.supplier_id,
    purchase_price = excluded.purchase_price,
    sale_price = excluded.sale_price,
    stock_quantity = excluded.stock_quantity,
    min_stock = excluded.min_stock;
