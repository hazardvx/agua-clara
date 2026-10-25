create extension if not exists pgcrypto;
create type public.app_role as enum ('cliente','administradora','repartidor');
create type public.order_status as enum ('Pendiente','Aceptado','En preparación','Asignado','En camino','Listo para recoger','Entregado','Entrega fallida','Cancelado');
create type public.payment_status as enum ('Pendiente','En proceso','Pagado','Fallido','Reembolsado');
create table public.profiles(id uuid primary key references auth.users(id) on delete cascade, full_name text not null, phone text, role public.app_role not null default 'cliente', created_at timestamptz not null default now());
create table public.products(id uuid primary key default gen_random_uuid(), name text not null, container_type text not null, price_cents integer not null check(price_cents>=0), available boolean not null default true, created_at timestamptz not null default now());
create table public.business_settings(key text primary key, value text not null, updated_at timestamptz not null default now());
insert into public.business_settings(key,value) values ('shipping_cents','450') on conflict do nothing;
create table public.addresses(id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.profiles(id), label text not null, address_text text not null, reference_text text, latitude numeric, longitude numeric);
create table public.orders(id uuid primary key default gen_random_uuid(), order_number text unique not null, customer_id uuid references public.profiles(id), source text not null default 'web', mode text not null check(mode in ('delivery','pickup')), address_text text, status public.order_status not null default 'Pendiente', payment_method text not null, payment_status public.payment_status not null default 'Pendiente', subtotal_cents integer not null, shipping_cents integer not null, total_cents integer not null, idempotency_key uuid unique not null, created_at timestamptz not null default now());
create table public.order_items(id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade, product_id uuid references public.products(id), product_name text not null, quantity integer not null check(quantity>0), unit_price_cents integer not null check(unit_price_cents>=0));
create table public.order_events(id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade, previous_status public.order_status, new_status public.order_status not null, actor_id uuid references public.profiles(id), created_at timestamptz not null default now());
create table public.vehicles(id uuid primary key default gen_random_uuid(), name text not null, plate text, active boolean not null default true);
create table public.delivery_assignments(id uuid primary key default gen_random_uuid(), order_id uuid unique not null references public.orders(id) on delete cascade, courier_id uuid references public.profiles(id), vehicle_id uuid references public.vehicles(id), empty_containers integer not null default 0, notes text);
create table public.payments(id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade, status public.payment_status not null default 'Pendiente', amount_cents integer not null, provider text, provider_reference text, received_at timestamptz);
alter table public.profiles enable row level security; alter table public.products enable row level security; alter table public.business_settings enable row level security; alter table public.addresses enable row level security; alter table public.orders enable row level security; alter table public.order_items enable row level security; alter table public.order_events enable row level security; alter table public.vehicles enable row level security; alter table public.delivery_assignments enable row level security; alter table public.payments enable row level security;
create or replace function public.is_staff() returns boolean language sql stable as $$ select exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('administradora','repartidor')) $$;
create policy "products public read" on public.products for select using (available=true or public.is_staff());
create policy "own profile" on public.profiles for select using (id=auth.uid() or public.is_staff());
create policy "own addresses" on public.addresses for all using (customer_id=auth.uid() or public.is_staff()) with check (customer_id=auth.uid() or public.is_staff());
create policy "customer own orders or staff" on public.orders for select using (customer_id=auth.uid() or public.is_staff());
create policy "customer create orders" on public.orders for insert with check (customer_id=auth.uid() or public.is_staff());
create policy "staff update orders" on public.orders for update using (public.is_staff()) with check (public.is_staff());
create policy "order items visible" on public.order_items for select using (exists(select 1 from public.orders o where o.id=order_id and (o.customer_id=auth.uid() or public.is_staff())));
create policy "staff manage delivery" on public.delivery_assignments for all using (public.is_staff()) with check (public.is_staff());
create policy "payment owner or staff" on public.payments for select using (exists(select 1 from public.orders o where o.id=order_id and (o.customer_id=auth.uid() or public.is_staff())));
create or replace function public.calculate_order_total(p_subtotal integer,p_mode text) returns integer language sql immutable as $$ select p_subtotal + case when p_mode='delivery' then 450 else 0 end $$;

-- El cliente nunca debe poder decidir los importes finales. Esta función es la puerta
-- recomendada para crear pedidos desde la aplicación conectada a Supabase.
create or replace function public.create_order(
  p_order_number text,
  p_mode text,
  p_address_text text,
  p_payment_method text,
  p_idempotency_key uuid,
  p_items jsonb
) returns public.orders
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_order public.orders;
  v_subtotal integer := 0;
  v_shipping integer := case when p_mode='delivery' then coalesce((select value::integer from public.business_settings where key='shipping_cents'),450) else 0 end;
  v_item jsonb;
  v_product public.products;
begin
  if p_mode not in ('delivery','pickup') then raise exception 'Modalidad inválida'; end if;
  if p_mode='delivery' and nullif(trim(p_address_text),'') is null then raise exception 'La entrega requiere dirección'; end if;
  if exists(select 1 from public.orders where idempotency_key=p_idempotency_key) then
    select * into v_order from public.orders where idempotency_key=p_idempotency_key;
    return v_order;
  end if;
  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_product from public.products where id=(v_item->>'product_id')::uuid and available=true;
    if not found then raise exception 'Producto no disponible'; end if;
    if (v_item->>'quantity')::integer < 1 then raise exception 'Cantidad inválida'; end if;
    v_subtotal := v_subtotal + ((v_item->>'quantity')::integer * v_product.price_cents);
  end loop;
  insert into public.orders(order_number,customer_id,mode,address_text,payment_method,subtotal_cents,shipping_cents,total_cents,idempotency_key)
  values(p_order_number,auth.uid(),p_mode,p_address_text,p_payment_method,v_subtotal,v_shipping,v_subtotal+v_shipping,p_idempotency_key)
  returning * into v_order;
  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_product from public.products where id=(v_item->>'product_id')::uuid;
    insert into public.order_items(order_id,product_id,product_name,quantity,unit_price_cents)
    values(v_order.id,v_product.id,v_product.name,(v_item->>'quantity')::integer,v_product.price_cents);
  end loop;
  insert into public.order_events(order_id,new_status,actor_id) values(v_order.id,'Pendiente',auth.uid());
  return v_order;
end $$;

revoke all on function public.create_order(text,text,text,text,uuid,jsonb) from public, anon;
grant execute on function public.create_order(text,text,text,text,uuid,jsonb) to authenticated;
