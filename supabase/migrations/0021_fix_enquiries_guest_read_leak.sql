-- Module 5 fix: enquiries' SELECT policy leaked every guest submission's
-- PII to every anonymous visitor.
--
-- 0006_enquiries_quotations_appointments.sql (Module 1) wrote:
--   using (customer_id = auth.uid() or customer_id is null or public.is_admin())
-- The `customer_id is null` clause was meant to let a guest read back
-- their own submission, but there's no way to scope "their own" for an
-- anonymous caller — Postgres has no per-session identity for anon, only
-- the role. The clause actually let ANY anonymous visitor read EVERY
-- guest-submitted row: contact_name, contact_email, contact_phone,
-- message. Confirmed live before this fix: submitted a guest enquiry from
-- one anonymous session, read it back in full from a totally unrelated
-- anonymous session.
--
-- Fix: drop the `customer_id is null` read path entirely. Guests can still
-- insert (unchanged); only the submitter-if-signed-in or an admin can read
-- a row back. A guest who wants to check their enquiry status has to do it
-- through account creation, same as this business's order/enquiry model
-- generally — no share-token workaround is worth adding for this.
drop policy "Enquiries are viewable by their owner or admin" on public.enquiries;

create policy "Enquiries are viewable by their owner or admin"
  on public.enquiries for select
  using (customer_id = auth.uid() or public.is_admin());
