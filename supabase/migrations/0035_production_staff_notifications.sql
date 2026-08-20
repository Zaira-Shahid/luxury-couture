-- Module 13 follow-up: advanceProductionStatus inserts a notifications row
-- for the customer (same pattern as Module 12's updateOrderStatus), but
-- notifications' only INSERT policy is admin-only (0009) — a 'production'
-- role account calling that action would hit a real RLS insert error (not
-- just the customer-facing bits of the action succeeding while this one
-- silently no-ops, since insert with check violations do error). Scoped
-- to insert only — production staff still can't read/update notifications
-- generally.
create policy "Notifications are also created by production staff"
  on public.notifications for insert with check (public.is_production_staff());
