-- Module 12: order status timeline and private admin notes.

create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  status text not null,
  note text,
  changed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index order_status_history_order_id_idx on public.order_status_history (order_id);

alter table public.order_status_history enable row level security;

create policy "Order status history is viewable with its order"
  on public.order_status_history for select
  using (
    public.is_admin()
    or exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid())
  );

create policy "Order status history is created by admin"
  on public.order_status_history for insert with check (public.is_admin());

--------------------------------------------------------------------------------

-- Private internal notes about an order — deliberately a separate
-- admin-only table, not a column on orders. orders' own SELECT policy
-- grants the owning customer full-row access, so a plain admin_notes
-- column would be readable by any query that customer's session can
-- construct, not just whatever the app's UI happens to select. A
-- separate all-admin table closes that off structurally, same shape as
-- payment_transactions.
create table public.order_notes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  note text not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index order_notes_order_id_idx on public.order_notes (order_id);

alter table public.order_notes enable row level security;

create policy "Order notes are admin-only"
  on public.order_notes for all
  using (public.is_admin())
  with check (public.is_admin());
