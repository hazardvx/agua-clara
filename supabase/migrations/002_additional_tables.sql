-- ============================================================
-- Migración 002: Tablas adicionales solicitadas
-- Ejecutar después de 001_initial.sql
-- ============================================================

-- Zonas de entrega (para cuando se quieran configurar)
create table if not exists public.delivery_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  extra_cents integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.delivery_zones enable row level security;
create policy "staff manage zones" on public.delivery_zones
  for all using (public.is_staff()) with check (public.is_staff());
create policy "public read zones" on public.delivery_zones
  for select using (active = true);

-- Inventario de productos
create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  quantity integer not null default 0,
  min_stock integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (product_id)
);

alter table public.inventory enable row level security;
create policy "staff manage inventory" on public.inventory
  for all using (public.is_staff()) with check (public.is_staff());
create policy "public read inventory" on public.inventory
  for select using (true);

-- Movimientos de existencias
create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  quantity integer not null, -- positivo = entrada, negativo = salida
  reason text not null, -- 'compra', 'venta', 'ajuste', 'merma'
  reference_id uuid, -- puede referenciar un pedido u otra tabla
  actor_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.stock_movements enable row level security;
create policy "staff manage stock" on public.stock_movements
  for all using (public.is_staff()) with check (public.is_staff());

-- Registro de envases (container ledger)
-- Permite llevar cuenta de botellones prestados, devueltos, etc.
create table if not exists public.container_ledger (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.profiles(id),
  order_id uuid references public.orders(id),
  container_type text not null, -- 'Retornable', 'Nuevo'
  movement text not null check (movement in ('entregado', 'devuelto', 'perdido', 'ajuste')),
  quantity integer not null check (quantity > 0),
  notes text,
  actor_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.container_ledger enable row level security;
create policy "staff manage containers" on public.container_ledger
  for all using (public.is_staff()) with check (public.is_staff());
create policy "customer own containers" on public.container_ledger
  for select using (customer_id = auth.uid());

-- Registro de notificaciones (WhatsApp, email, push)
create table if not exists public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id),
  channel text not null, -- 'whatsapp', 'sms', 'push', 'email'
  recipient text not null, -- número o dirección
  template text, -- nombre de la plantilla usada
  message_preview text, -- primeros 200 caracteres
  status text not null default 'pendiente', -- 'pendiente', 'enviado', 'entregado', 'fallido'
  provider_reference text, -- ID de referencia del proveedor
  error_detail text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.notification_logs enable row level security;
create policy "staff read notifications" on public.notification_logs
  for select using (public.is_staff());
create policy "staff create notifications" on public.notification_logs
  for insert with check (public.is_staff());

-- Añadir columnas opcionales a tablas existentes si no existen

-- Dirección: zona de entrega opcional
do $$ begin
  alter table public.addresses add column if not exists zone_id uuid references public.delivery_zones(id);
exception when others then null; end $$;

-- Pedido: zona de entrega y referencia de dirección
do $$ begin
  alter table public.orders add column if not exists address_reference text;
  alter table public.orders add column if not exists zone_id uuid references public.delivery_zones(id);
  alter table public.orders add column if not exists customer_name text;
  alter table public.orders add column if not exists customer_phone text;
exception when others then null; end $$;

-- Asignación: notas de entrega, envases recogidos, resultado
do $$ begin
  alter table public.delivery_assignments add column if not exists delivery_notes text;
  alter table public.delivery_assignments add column if not exists failure_reason text;
  alter table public.delivery_assignments add column if not exists completed_at timestamptz;
exception when others then null; end $$;

-- Pago: campo de notas
do $$ begin
  alter table public.payments add column if not exists notes text;
exception when others then null; end $$;

-- Producto: descripción e imagen
do $$ begin
  alter table public.products add column if not exists description text;
  alter table public.products add column if not exists image_url text;
exception when others then null; end $$;

-- Settings adicionales por defecto
insert into public.business_settings(key, value) values
  ('business_name', 'Agua Clara'),
  ('store_pickup', 'Calle principal, frente al parque · 8:00 a.m. a 5:00 p.m.'),
  ('pickup_enabled', 'true'),
  ('whatsapp_number', ''),
  ('yappy_merchant_id', ''),
  ('yappy_configured', 'false'),
  ('whatsapp_api_configured', 'false')
on conflict (key) do nothing;

-- Índices para mejorar consultas frecuentes
create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_orders_customer on public.orders(customer_id);
create index if not exists idx_orders_created on public.orders(created_at desc);
create index if not exists idx_order_items_order on public.order_items(order_id);
create index if not exists idx_order_events_order on public.order_events(order_id);
create index if not exists idx_delivery_assignments_courier on public.delivery_assignments(courier_id);
create index if not exists idx_payments_order on public.payments(order_id);
create index if not exists idx_container_ledger_customer on public.container_ledger(customer_id);
create index if not exists idx_notification_logs_order on public.notification_logs(order_id);

-- Función auxiliar: verificar si el usuario es administradora
create or replace function public.is_admin() returns boolean
language sql stable
as $$
  select exists(
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'administradora'
  )
$$;

-- Política: solo la administradora puede cambiar configuraciones
create policy "admin manage settings" on public.business_settings
  for all using (public.is_admin()) with check (public.is_admin());

-- Política: cualquiera puede leer configuraciones públicas
create policy "public read settings" on public.business_settings
  for select using (true);

-- Función: registrar evento de pedido automáticamente al cambiar estado
create or replace function public.log_order_status_change()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status then
    insert into public.order_events(order_id, previous_status, new_status, actor_id)
    values (new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end
$$;

-- Solo crear el trigger si no existe
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_order_status_change') then
    create trigger trg_order_status_change
      after update of status on public.orders
      for each row
      execute function public.log_order_status_change();
  end if;
end $$;

-- RLS para la tabla profiles: permitir al usuario crear su propio perfil
create policy "user create own profile" on public.profiles
  for insert with check (id = auth.uid());

-- RLS para la tabla profiles: permitir actualizar datos propios
create policy "user update own profile" on public.profiles
  for update using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());
