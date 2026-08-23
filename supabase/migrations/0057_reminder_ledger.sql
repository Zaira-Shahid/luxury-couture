-- Module 27, Pass 2 — the reminder ledger.
--
-- A LEDGER rather than a `last_reminded_at` column on orders and
-- appointments, for three reasons:
--
--  1. A messaging concern should not mutate a business table. Touching
--     `orders` to record that an email went out bumps its updated_at and
--     makes "when did this order last change" mean two different things.
--  2. The primary key makes a double-send IMPOSSIBLE rather than merely
--     unlikely. The cron inserts first and sends second; if the insert
--     conflicts, someone already sent it and this run does nothing. Two
--     overlapping cron invocations cannot both win.
--  3. One table covers every future reminder kind without another
--     migration per business table.
--
-- Deliberately NOT unique on (entity, kind) alone: `kind` carries the
-- occurrence, so a balance reminder can legitimately recur on a schedule
-- while a "24 hours before your appointment" reminder can only ever fire
-- once for a given appointment.

create table public.notification_reminders (
  entity_type text not null check (entity_type in ('order', 'appointment')),
  entity_id uuid not null,
  kind text not null,
  sent_at timestamptz not null default now(),
  primary key (entity_type, entity_id, kind)
);

create index notification_reminders_sent_at_idx on public.notification_reminders (sent_at);

alter table public.notification_reminders enable row level security;

-- No policy grants anything to a signed-in user, and that is the whole
-- intent: this table is written only by the reminder cron, which uses the
-- service-role client and bypasses RLS entirely. RLS is enabled so that a
-- customer or a staff account reaching it through the API gets nothing
-- rather than everything — a table with RLS enabled and no policy denies
-- by default.
--
-- Admins are given read access only, so the reminder history is
-- inspectable when a customer asks "did you ever tell me?".
create policy "Reminder history is readable by admin"
  on public.notification_reminders for select
  using (public.is_admin());
