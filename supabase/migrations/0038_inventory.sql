-- Module 17: inventory. One generic table covers fabrics, generic
-- materials, and embroidery materials — the plan's own wording is
-- "designed to support" these categories, not three separate tables.
-- fabric_id links stock to an actual customer-facing fabric option when
-- category = 'fabric'; generic materials and embroidery supplies (thread,
-- sequins, lining, trims) have no natural FK to any existing table — they
-- are raw supplies, not customer-facing style choices like
-- embroidery_types.
--
-- reserved_quantity is admin-edited only, not automatically maintained by
-- orders — no bill-of-materials linking products/builder configurations
-- to material consumption exists anywhere in this schema, and building
-- one is well beyond this module's "designed to support" scope.
-- is_available is a manual override (stock can be > 0 but marked
-- unavailable, e.g. a supplier issue) — "low stock" itself is derived
-- (stock_quantity - reserved_quantity <= low_stock_threshold), not stored.
create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('fabric', 'material', 'embroidery_material')),
  fabric_id uuid references public.fabrics (id) on delete set null,
  name text not null,
  sku text,
  unit text not null default 'meters',
  stock_quantity numeric(10, 2) not null default 0 check (stock_quantity >= 0),
  reserved_quantity numeric(10, 2) not null default 0 check (reserved_quantity >= 0),
  low_stock_threshold numeric(10, 2) not null default 0 check (low_stock_threshold >= 0),
  is_available boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index inventory_items_category_idx on public.inventory_items (category);
create index inventory_items_fabric_id_idx on public.inventory_items (fabric_id);

create trigger set_inventory_items_updated_at
  before update on public.inventory_items
  for each row execute function public.set_updated_at();

alter table public.inventory_items enable row level security;

-- Purely internal ops data, unlike fabrics/etc. which are customer-facing
-- via the builder — admin-only, same shape as order_notes/
-- payment_transactions. No staff/production carve-out: that gap is
-- explicitly deferred to Module 26 project-wide, not something to
-- re-open here.
create policy "Inventory items are admin-only"
  on public.inventory_items for all
  using (public.is_admin())
  with check (public.is_admin());
