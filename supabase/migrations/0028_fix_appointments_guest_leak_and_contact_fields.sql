-- Module 9: close a third instance of the same guest-scan leak pattern
-- found in Modules 5 (enquiries, 0021) and 6 (builder_configurations/
-- inspiration_images, 0022) — appointments' SELECT policy had the
-- identical `customer_id is null` clause. Confirmed live before fixing: a
-- guest appointment's private notes were fully readable from a completely
-- unrelated anonymous session via a blind table scan.
drop policy "Appointments are viewable by their owner or admin"
  on public.appointments;

create policy "Appointments are viewable by their owner or admin"
  on public.appointments for select
  using (customer_id = auth.uid() or public.is_admin());

-- Alongside the leak: appointments had no way to identify a guest booking
-- at all (no contact_name/email/phone), unlike enquiries. Fixing the read
-- leak without this would leave guest booking unusable either way — a
-- guest could create an appointment nobody could ever contact them about.
-- Matches enquiries' exact shape: name/email required, phone optional.
-- Table is empty in production today (verified before writing this), so
-- no backfill dance is needed for the not-null columns.
alter table public.appointments
  add column contact_name text not null default '',
  add column contact_email text not null default '',
  add column contact_phone text;

alter table public.appointments
  alter column contact_name drop default,
  alter column contact_email drop default;
