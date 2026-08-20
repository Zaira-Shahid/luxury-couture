-- Module 13 fix: 0034's new orders/order_items SELECT policies check
-- production_orders via a raw EXISTS subquery. But production_orders'
-- own (pre-existing, 0008) SELECT policy checks back into orders
-- (o.customer_id = auth.uid()) to let the owning customer read it —
-- so evaluating the orders policy triggers production_orders' policy,
-- which triggers the orders policy again: "infinite recursion detected
-- in policy for relation orders" (42P17), confirmed live the moment an
-- admin tried to read any order at all.
--
-- Fix: route the existence check through a SECURITY DEFINER function,
-- the same technique is_admin() already uses to read profiles without
-- recursing into profiles' own RLS — the function's query runs outside
-- RLS entirely, so it can never re-trigger production_orders' policies.
create or replace function public.order_has_production_handoff(p_order_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.production_orders where order_id = p_order_id);
$$;

drop policy "Orders are also viewable by production staff once handed off" on public.orders;
create policy "Orders are also viewable by production staff once handed off"
  on public.orders for select
  using (public.is_production_staff() and public.order_has_production_handoff(orders.id));

drop policy "Order items are also viewable by production staff once handed off" on public.order_items;
create policy "Order items are also viewable by production staff once handed off"
  on public.order_items for select
  using (public.is_production_staff() and public.order_has_production_handoff(order_items.order_id));
