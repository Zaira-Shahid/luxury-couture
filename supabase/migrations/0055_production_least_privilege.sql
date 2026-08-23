-- Module 26, Pass 2 follow-up — restores Module 13's deliberate narrowing.
--
-- WHAT WENT WRONG. 0053 seeded the 'production' role with orders.read, and
-- 0054 turned that into a SELECT policy covering every row of `orders`.
-- That silently undid a boundary Module 13 had drawn on purpose: 0034
-- gave production staff
--
--   using (is_production_staff() and order_has_production_handoff(id))
--
-- with the comment *"can only read the underlying orders/order_items for
-- an order that has actually been handed to production — not the full
-- order book, not orders still in sales/negotiation."*
--
-- scripts/test-production.mjs caught it, exactly as intended: it asserts
-- that production staff CANNOT read an un-handed-off order, and that an
-- unfiltered scan returns 1 order rather than 2. This is the risk this
-- module always carried — not breaking admin (PERMISSIVE policies are
-- OR'd, so that cannot happen), but granting a new role too much.
--
-- THE FIX is to take the permission away rather than to weaken the
-- policy: `production` keeps precisely the handed-off access 0034
-- designed, through the policy 0034 already wrote.
--
-- `qc` loses it for the same reason. Quality control reads production
-- records and writes outcomes; the order book is not part of that job.

delete from public.role_permissions
where role in ('production', 'qc') and permission_key = 'orders.read';

-- The workshop still has to know what it is cutting to. Measurements were
-- gated on orders.read in 0054, which was right for sales and wrong for
-- production, so they get their own grant under production.read instead
-- of handing the order book back.
create policy "Measurement profiles are readable with production.read"
  on public.measurement_profiles for select using (public.has_permission('production.read'));
create policy "Measurements are readable with production.read"
  on public.measurements for select using (public.has_permission('production.read'));
