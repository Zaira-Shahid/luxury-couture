-- Module 27, Pass 1 — the customer notification centre.
--
-- Three additions to a table that has existed since 0009 and a new
-- preferences table. Every policy statement here is `create policy`; no
-- existing policy is dropped or altered, so scripts/snapshot-policies.mjs
-- reports this as additive (see docs/PERMISSIONS.md for why that matters).
--
-- THE DESIGN DECISION, recorded here because it is the one someone will
-- want to reverse later without knowing why it was made:
--
--   Preferences control EMAIL ONLY. The in-app feed is always on.
--
-- A customer who has paid a four-figure deposit should not be able to
-- switch off the in-app record that their order shipped — that feed is
-- their receipt trail, and "I muted it, then complained I was never
-- told" is a dispute nobody wins. Email is the intrusive channel and the
-- one worth muting; the feed is the record.

-- ---------------------------------------------------------------------
-- Categories on notifications
--
-- NULLABLE on purpose. notify() has 18 call sites passing {type, title,
-- body}; a NOT NULL column would break every one of them at once. The
-- category is derived inside notify() from the `type` those call sites
-- already pass, so they stay untouched, and a row that somehow arrives
-- without one still inserts rather than throwing at the customer.

alter table public.notifications
  add column category text
    check (category is null or category in (
      'orders', 'payments', 'production', 'shipping', 'consultations', 'reviews'
    )),
  -- Deep link to whatever the notification is about. `metadata` jsonb has
  -- been on this table since 0009 and is used by exactly zero call sites;
  -- a plain text column is what the UI actually needs and cannot be
  -- mis-shaped the way an untyped blob can.
  add column link text;

-- Backfill from the 16 template types that exist today, so the filter and
-- the preference checks apply to history as well as to new rows.
update public.notifications set category = case
  when type in ('order_confirmed', 'order_status_changed', 'order_message',
                'quote_created', 'quote_approved', 'enquiry_received') then 'orders'
  when type in ('deposit_paid', 'balance_due') then 'payments'
  when type in ('production_started', 'production_status_changed', 'qc_complete') then 'production'
  when type in ('shipped', 'delivered', 'shipping_status_changed') then 'shipping'
  when type in ('review_request') then 'reviews'
  else null
end
where category is null;

-- The unread badge queries this on every account page render.
create index notifications_unread_idx
  on public.notifications (profile_id, read_at)
  where read_at is null;

create index notifications_category_idx on public.notifications (profile_id, category);

-- ---------------------------------------------------------------------
-- Per-customer email preferences
--
-- ABSENT ROW MEANS OPTED IN. A customer who never opens this screen keeps
-- receiving their order emails, which is the only safe default for
-- transactional mail: the failure mode of the opposite default is a
-- customer silently not being told their order shipped.
--
-- 'marketing' is deliberately NOT a category here. Marketing opt-out
-- already lives on profiles.marketing_opt_out (Module 24) and is honoured
-- by the unsubscribe link; a second switch would be a second source of
-- truth for the same question, and they would drift.

create table public.notification_preferences (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  category text not null check (category in (
    'orders', 'payments', 'production', 'shipping', 'consultations', 'reviews'
  )),
  email_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (profile_id, category)
);

alter table public.notification_preferences enable row level security;

create trigger set_notification_preferences_updated_at
  before update on public.notification_preferences
  for each row execute function public.set_updated_at();

-- Owner-only, all four commands. Not `or is_admin()`: an admin has no
-- reason to read what a customer has muted, and every extra reader of a
-- preference table is a way for it to be changed by someone who is not
-- the person it speaks for.
create policy "Notification preferences are managed by their owner"
  on public.notification_preferences for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- ---------------------------------------------------------------------
-- Should this notification be emailed?
--
-- SECURITY DEFINER for the same reason has_permission() is (0053): it is
-- called from server code holding the service-role client (the reminder
-- cron in Pass 2) as well as from a user session, and it must give the
-- same answer either way rather than depending on whose RLS is in force.
--
-- FAILS OPEN, which is the opposite of has_permission() and deliberate.
-- A permission lookup that fails must deny; a transactional-email lookup
-- that fails must still send, because the cost of a wrongly-sent order
-- confirmation is an unwanted email and the cost of a wrongly-suppressed
-- one is a customer never learning their order shipped.

create or replace function public.wants_email(p_profile_id uuid, p_category text)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_enabled boolean;
begin
  if p_profile_id is null or p_category is null then
    return true;
  end if;

  select email_enabled into v_enabled
  from public.notification_preferences
  where profile_id = p_profile_id and category = p_category;

  -- No row means the customer has never expressed a preference.
  return coalesce(v_enabled, true);
end;
$$;
