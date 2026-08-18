-- Module 1: production workflow (section 13's 12-stage pipeline) and shipping.

create table public.production_orders (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  current_status text not null default 'order_confirmed' check (current_status in (
    'order_confirmed', 'measurements_verified', 'design_approved', 'materials_prepared',
    'cutting', 'embroidery', 'stitching', 'finishing', 'quality_check',
    'ready_for_dispatch', 'shipped', 'delivered'
  )),
  assigned_team text,
  estimated_completion_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_production_orders_updated_at
  before update on public.production_orders
  for each row execute function public.set_updated_at();

alter table public.production_orders enable row level security;

create policy "Production orders are viewable with their order"
  on public.production_orders for select
  using (
    public.is_admin()
    or exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid())
  );

create policy "Production orders are managed by admin"
  on public.production_orders for insert with check (public.is_admin());
create policy "Production orders are updated by admin"
  on public.production_orders for update using (public.is_admin());

--------------------------------------------------------------------------------

create table public.production_status_history (
  id uuid primary key default gen_random_uuid(),
  production_order_id uuid not null references public.production_orders (id) on delete cascade,
  status text not null,
  note text,
  changed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index production_status_history_production_order_id_idx
  on public.production_status_history (production_order_id);

alter table public.production_status_history enable row level security;

create policy "Production status history is viewable with its order"
  on public.production_status_history for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.production_orders po
      join public.orders o on o.id = po.order_id
      where po.id = production_order_id and o.customer_id = auth.uid()
    )
  );

create policy "Production status history is managed by admin"
  on public.production_status_history for insert with check (public.is_admin());

--------------------------------------------------------------------------------

create table public.shipping_orders (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  address_id uuid references public.addresses (id) on delete set null,
  courier text,
  tracking_number text,
  status text not null default 'pending' check (status in (
    'pending', 'label_created', 'in_transit', 'out_for_delivery', 'delivered', 'exception'
  )),
  shipping_cost numeric(10, 2),
  shipped_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_shipping_orders_updated_at
  before update on public.shipping_orders
  for each row execute function public.set_updated_at();

alter table public.shipping_orders enable row level security;

create policy "Shipping orders are viewable with their order"
  on public.shipping_orders for select
  using (
    public.is_admin()
    or exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid())
  );

create policy "Shipping orders are managed by admin"
  on public.shipping_orders for insert with check (public.is_admin());
create policy "Shipping orders are updated by admin"
  on public.shipping_orders for update using (public.is_admin());

--------------------------------------------------------------------------------

create table public.shipping_events (
  id uuid primary key default gen_random_uuid(),
  shipping_order_id uuid not null references public.shipping_orders (id) on delete cascade,
  status text not null,
  description text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index shipping_events_shipping_order_id_idx on public.shipping_events (shipping_order_id);

alter table public.shipping_events enable row level security;

create policy "Shipping events are viewable with their order"
  on public.shipping_events for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.shipping_orders so
      join public.orders o on o.id = so.order_id
      where so.id = shipping_order_id and o.customer_id = auth.uid()
    )
  );

create policy "Shipping events are managed by admin"
  on public.shipping_events for insert with check (public.is_admin());
