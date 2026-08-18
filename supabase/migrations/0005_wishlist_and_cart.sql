-- Module 1: wishlist and cart. A single wishlist_items bag replaces the
-- planned wishlists + wishlist_items pair — nothing requires multiple
-- named wishlists per customer.

create table public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (customer_id, product_id)
);

create index wishlist_items_customer_id_idx on public.wishlist_items (customer_id);

alter table public.wishlist_items enable row level security;

create policy "Wishlist items are managed by their owner or admin"
  on public.wishlist_items for all
  using (customer_id = auth.uid() or public.is_admin())
  with check (customer_id = auth.uid() or public.is_admin());

--------------------------------------------------------------------------------

-- Guest carts (customer_id null) are keyed by a client-held session_id,
-- the same obscurity pattern as builder_configurations.share_token —
-- Module 10 (checkout) can harden this further when it lands.
create table public.carts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.profiles (id) on delete cascade,
  session_id text,
  status text not null default 'active'
    check (status in ('active', 'converted', 'abandoned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (customer_id is not null or session_id is not null)
);

create index carts_customer_id_idx on public.carts (customer_id);
create index carts_session_id_idx on public.carts (session_id);

create trigger set_carts_updated_at
  before update on public.carts
  for each row execute function public.set_updated_at();

alter table public.carts enable row level security;

create policy "Carts are usable by their owner, guest session, or admin"
  on public.carts for all
  using (customer_id = auth.uid() or customer_id is null or public.is_admin())
  with check (customer_id = auth.uid() or customer_id is null);

--------------------------------------------------------------------------------

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts (id) on delete cascade,
  product_id uuid references public.products (id) on delete restrict,
  builder_configuration_id uuid references public.builder_configurations (id) on delete restrict,
  quantity integer not null default 1 check (quantity > 0),
  -- Client-writable display price only — NOT a source of truth. Checkout
  -- (Module 10) must re-derive real prices server-side from products/
  -- builder_configurations before creating an order, per "never trust
  -- client-submitted prices" (section 11). A tampered value here can only
  -- mislead the cart UI, never actually charge the wrong amount.
  unit_price_snapshot numeric(10, 2) not null check (unit_price_snapshot >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (product_id is not null)::int + (builder_configuration_id is not null)::int = 1
  )
);

create index cart_items_cart_id_idx on public.cart_items (cart_id);

create trigger set_cart_items_updated_at
  before update on public.cart_items
  for each row execute function public.set_updated_at();

alter table public.cart_items enable row level security;

create policy "Cart items follow their cart's visibility"
  on public.cart_items for all
  using (
    exists (
      select 1 from public.carts c
      where c.id = cart_id
        and (c.customer_id = auth.uid() or c.customer_id is null or public.is_admin())
    )
  )
  with check (
    exists (
      select 1 from public.carts c
      where c.id = cart_id and (c.customer_id = auth.uid() or c.customer_id is null)
    )
  );
