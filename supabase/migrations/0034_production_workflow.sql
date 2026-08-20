-- Module 13: production workflow. Closes a narrow slice of the known
-- is_admin()-only RLS gap (docs/ARCHITECTURE.md, Module 5 note) — just
-- enough for a 'production'-role account to do this module's job, not
-- the general per-role permission system (that's Module 26). Additive
-- policies only; every existing is_admin()-gated policy is untouched.

create or replace function public.is_production_staff()
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'production'
  );
end;
$$;

-- Production staff can read/write production_orders and
-- production_status_history for any order (that's their whole job), but
-- can only read the underlying orders/order_items for an order that has
-- actually been handed to production — not the full order book, not
-- orders still in sales/negotiation. Select/insert/update only, matching
-- exactly what admin already has on these two tables — no delete policy
-- exists for anyone here, so none is added for production staff either.

create policy "Production orders are also viewable by production staff"
  on public.production_orders for select
  using (public.is_production_staff());
create policy "Production orders are also insertable by production staff"
  on public.production_orders for insert with check (public.is_production_staff());
create policy "Production orders are also updatable by production staff"
  on public.production_orders for update using (public.is_production_staff());

create policy "Production status history is also viewable by production staff"
  on public.production_status_history for select
  using (public.is_production_staff());
create policy "Production status history is also insertable by production staff"
  on public.production_status_history for insert with check (public.is_production_staff());

create policy "Orders are also viewable by production staff once handed off"
  on public.orders for select
  using (
    public.is_production_staff()
    and exists (select 1 from public.production_orders po where po.order_id = orders.id)
  );

create policy "Order items are also viewable by production staff once handed off"
  on public.order_items for select
  using (
    public.is_production_staff()
    and exists (select 1 from public.production_orders po where po.order_id = order_items.order_id)
  );
