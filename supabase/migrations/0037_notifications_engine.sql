-- Module 15: notifications architecture support.

-- Customer-initiated events (enquiry received, quote approved) need the
-- customer's own session to insert a notification about themselves —
-- until now notifications' only INSERT policies were admin/production-
-- staff-only (0009, 0035). A direct profile_id = auth.uid() comparison,
-- no subquery into another table, so this can't reproduce 0034's
-- recursion bug.
create policy "Users can create their own notifications"
  on public.notifications for insert
  with check (profile_id = auth.uid());

-- "account created" is the one event handled entirely at the DB layer —
-- a trigger can't call the app's lib/notifications/notify() or its
-- templates, so the welcome message is duplicated here in SQL. No mock
-- email is sent for this event (documented limitation — see
-- docs/ARCHITECTURE.md).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');

  insert into public.notifications (profile_id, type, title, body, channel)
  values (
    new.id,
    'account_created',
    'Welcome to Luxury Lehenga Couture',
    'Your account has been created. Explore our collections or start designing a custom lehenga whenever you''re ready.',
    'in_app'
  );

  return new;
end;
$$;
