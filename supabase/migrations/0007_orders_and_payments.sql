-- Module 1: orders, order items, and payments. Customers get read-only
-- access to their own rows — all writes happen server-side (service-role
-- client, added in this module as src/lib/supabase/admin.ts) once
-- prices/quantities/status have been validated, per "never trust
-- client-submitted prices/order status" (section 11).

create sequence public.order_number_seq;

create or replace function public.generate_order_number()
returns text
language sql
as $$
  select 'ORD-' || to_char(now(), 'YYYY') || '-'
    || lpad(nextval('public.order_number_seq')::text, 6, '0');
$$;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default public.generate_order_number(),
  customer_id uuid not null references public.profiles (id) on delete restrict,
  quotation_id uuid references public.quotations (id) on delete set null,
  measurement_profile_id uuid references public.measurement_profiles (id) on delete set null,
  shipping_address_id uuid references public.addresses (id) on delete set null,
  status text not null default 'pending' check (status in (
    'pending', 'confirmed', 'in_production', 'ready_to_ship',
    'shipped', 'delivered', 'cancelled'
  )),
  subtotal numeric(10, 2) not null default 0 check (subtotal >= 0),
  deposit_amount numeric(10, 2) not null default 0 check (deposit_amount >= 0),
  deposit_paid_amount numeric(10, 2) not null default 0 check (deposit_paid_amount >= 0),
  balance_due_amount numeric(10, 2) not null default 0 check (balance_due_amount >= 0),
  total_amount numeric(10, 2) not null default 0 check (total_amount >= 0),
  currency text not null default 'GBP',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_customer_id_idx on public.orders (customer_id);
create index orders_status_idx on public.orders (status);

create trigger set_orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

alter table public.orders enable row level security;

create policy "Orders are viewable by their customer or admin"
  on public.orders for select
  using (customer_id = auth.uid() or public.is_admin());

create policy "Orders are managed by admin"
  on public.orders for insert with check (public.is_admin());
create policy "Orders are updated by admin"
  on public.orders for update using (public.is_admin());

--------------------------------------------------------------------------------

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  builder_configuration_id uuid references public.builder_configurations (id) on delete set null,
  description_snapshot text not null,
  quantity integer not null default 1 check (quantity > 0),
  unit_price numeric(10, 2) not null check (unit_price >= 0),
  line_total numeric(10, 2) not null check (line_total >= 0),
  created_at timestamptz not null default now()
);

create index order_items_order_id_idx on public.order_items (order_id);

alter table public.order_items enable row level security;

create policy "Order items are viewable with their order"
  on public.order_items for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid()
    )
  );

create policy "Order items are managed by admin"
  on public.order_items for insert with check (public.is_admin());
create policy "Order items are updated by admin"
  on public.order_items for update using (public.is_admin());

--------------------------------------------------------------------------------

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  type text not null default 'deposit' check (type in ('deposit', 'balance', 'full', 'refund')),
  amount numeric(10, 2) not null check (amount >= 0),
  currency text not null default 'GBP',
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'failed', 'refunded')),
  provider text not null default 'manual' check (provider in ('stripe', 'paypal', 'manual')),
  provider_reference text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payments_order_id_idx on public.payments (order_id);

create trigger set_payments_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

alter table public.payments enable row level security;

create policy "Payments are viewable with their order"
  on public.payments for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid()
    )
  );

create policy "Payments are managed by admin"
  on public.payments for insert with check (public.is_admin());
create policy "Payments are updated by admin"
  on public.payments for update using (public.is_admin());

--------------------------------------------------------------------------------

-- Raw payment-provider webhook events, kept for audit/debugging. Never
-- exposed to customers.
create table public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id) on delete cascade,
  provider_event_type text,
  raw_payload jsonb,
  created_at timestamptz not null default now()
);

create index payment_transactions_payment_id_idx on public.payment_transactions (payment_id);

alter table public.payment_transactions enable row level security;

create policy "Payment transactions are admin-only"
  on public.payment_transactions for all
  using (public.is_admin())
  with check (public.is_admin());
