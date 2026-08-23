-- Module 26, Pass 2 — per-domain access for the new roles.
--
-- EVERY statement in this file is `create policy`. There is no
-- `drop policy`, no `alter policy`, and no `create or replace` of an
-- existing policy anywhere in it, and that is the whole safety argument:
--
--   PostgreSQL PERMISSIVE policies are OR'd together. Adding one can only
--   WIDEN access; it is mathematically incapable of revoking what an
--   existing policy already grants. So the 151 existing is_admin() checks
--   keep meaning exactly what they meant before this ran.
--
-- scripts/snapshot-policies.mjs proves that claim mechanically rather
-- than on trust: it diffs pg_policies before and after and fails if any
-- pre-existing policy was removed or altered.
--
-- The risk this file DOES carry is the opposite one — granting a role too
-- much. That is what the negative half of scripts/test-permissions.mjs is
-- for: for every "this role can", there is a "this role cannot".
--
-- Two deliberate omissions:
--   * audit_logs stays admin-only. A log that the people it records can
--     read on the strength of a domain permission is worth less.
--   * profiles is granted SELECT only. Role assignment stays behind
--     roles.manage and the 0017/0018 trigger; no domain permission here
--     opens a write path to it.

-- ---------------------------------------------------------------------
-- Orders

create policy "Orders are readable with orders.read"
  on public.orders for select using (public.has_permission('orders.read'));
create policy "Orders are insertable with orders.write"
  on public.orders for insert with check (public.has_permission('orders.write'));
create policy "Orders are updatable with orders.write"
  on public.orders for update using (public.has_permission('orders.write'));

create policy "Order items are readable with orders.read"
  on public.order_items for select using (public.has_permission('orders.read'));
create policy "Order items are insertable with orders.write"
  on public.order_items for insert with check (public.has_permission('orders.write'));
create policy "Order items are updatable with orders.write"
  on public.order_items for update using (public.has_permission('orders.write'));

create policy "Order notes are readable with orders.read"
  on public.order_notes for select using (public.has_permission('orders.read'));
create policy "Order notes are insertable with orders.write"
  on public.order_notes for insert with check (public.has_permission('orders.write'));

create policy "Order status history is readable with orders.read"
  on public.order_status_history for select using (public.has_permission('orders.read'));
create policy "Order status history is insertable with orders.write"
  on public.order_status_history for insert with check (public.has_permission('orders.write'));

-- Measurements belong to the order, not the catalogue: whoever can read
-- an order needs the measurements it is cut from.
create policy "Measurement profiles are readable with orders.read"
  on public.measurement_profiles for select using (public.has_permission('orders.read'));
create policy "Measurements are readable with orders.read"
  on public.measurements for select using (public.has_permission('orders.read'));
create policy "Measurement field definitions are managed with catalog.write"
  on public.measurement_field_definitions for all
  using (public.has_permission('catalog.write'))
  with check (public.has_permission('catalog.write'));

-- ---------------------------------------------------------------------
-- Quotations

create policy "Quotations are readable with quotations.read"
  on public.quotations for select using (public.has_permission('quotations.read'));
create policy "Quotations are insertable with quotations.write"
  on public.quotations for insert with check (public.has_permission('quotations.write'));
create policy "Quotations are updatable with quotations.write"
  on public.quotations for update using (public.has_permission('quotations.write'));

-- ---------------------------------------------------------------------
-- Customers
--
-- SELECT only, everywhere in this section. Reading a customer record is
-- part of several jobs; editing one is not.

create policy "Profiles are readable with customers.read"
  on public.profiles for select using (public.has_permission('customers.read'));
create policy "Addresses are readable with customers.read"
  on public.addresses for select using (public.has_permission('customers.read'));
create policy "Loyalty accounts are readable with customers.read"
  on public.loyalty_accounts for select using (public.has_permission('customers.read'));
create policy "Loyalty transactions are readable with customers.read"
  on public.loyalty_transactions for select using (public.has_permission('customers.read'));
create policy "Referrals are readable with customers.read"
  on public.referrals for select using (public.has_permission('customers.read'));

-- ---------------------------------------------------------------------
-- Payments
--
-- No DELETE. A payment record is evidence; corrections are made by
-- writing a further row, not by removing one.

create policy "Payments are readable with payments.read"
  on public.payments for select using (public.has_permission('payments.read'));
create policy "Payments are insertable with payments.write"
  on public.payments for insert with check (public.has_permission('payments.write'));
create policy "Payments are updatable with payments.write"
  on public.payments for update using (public.has_permission('payments.write'));

create policy "Payment transactions are readable with payments.read"
  on public.payment_transactions for select using (public.has_permission('payments.read'));
create policy "Payment transactions are insertable with payments.write"
  on public.payment_transactions for insert with check (public.has_permission('payments.write'));

-- ---------------------------------------------------------------------
-- Production and QC

create policy "Production orders are readable with production.read"
  on public.production_orders for select using (public.has_permission('production.read'));
create policy "Production orders are insertable with production.write"
  on public.production_orders for insert with check (public.has_permission('production.write'));
create policy "Production orders are updatable with production.write"
  on public.production_orders for update using (public.has_permission('production.write'));

create policy "Production history is readable with production.read"
  on public.production_status_history for select using (public.has_permission('production.read'));
create policy "Production history is insertable with production.write"
  on public.production_status_history for insert with check (public.has_permission('production.write'));

-- QC records outcomes into the same history table, which is why qc.write
-- gets its own INSERT policy rather than being folded into
-- production.write: a QC user must be able to record a result WITHOUT
-- being able to move the job through production themselves.
create policy "Production history is insertable with qc.write"
  on public.production_status_history for insert with check (public.has_permission('qc.write'));

-- ---------------------------------------------------------------------
-- Shipping

create policy "Shipping orders are readable with shipping.write"
  on public.shipping_orders for select using (public.has_permission('shipping.write'));
create policy "Shipping orders are insertable with shipping.write"
  on public.shipping_orders for insert with check (public.has_permission('shipping.write'));
create policy "Shipping orders are updatable with shipping.write"
  on public.shipping_orders for update using (public.has_permission('shipping.write'));

create policy "Shipping events are readable with shipping.write"
  on public.shipping_events for select using (public.has_permission('shipping.write'));
create policy "Shipping events are insertable with shipping.write"
  on public.shipping_events for insert with check (public.has_permission('shipping.write'));

-- ---------------------------------------------------------------------
-- Inventory

create policy "Inventory items are managed with inventory.write"
  on public.inventory_items for all
  using (public.has_permission('inventory.write'))
  with check (public.has_permission('inventory.write'));

-- ---------------------------------------------------------------------
-- Enquiries, appointments and chat

create policy "Enquiries are readable with enquiries.read"
  on public.enquiries for select using (public.has_permission('enquiries.read'));
create policy "Enquiries are insertable with enquiries.write"
  on public.enquiries for insert with check (public.has_permission('enquiries.write'));
create policy "Enquiries are updatable with enquiries.write"
  on public.enquiries for update using (public.has_permission('enquiries.write'));

create policy "Appointments are readable with enquiries.read"
  on public.appointments for select using (public.has_permission('enquiries.read'));
create policy "Appointments are updatable with enquiries.write"
  on public.appointments for update using (public.has_permission('enquiries.write'));

create policy "Chat conversations are readable with enquiries.read"
  on public.chat_conversations for select using (public.has_permission('enquiries.read'));
create policy "Chat messages are readable with enquiries.read"
  on public.chat_messages for select using (public.has_permission('enquiries.read'));

create policy "Consultation types are managed with enquiries.write"
  on public.consultation_types for all
  using (public.has_permission('enquiries.write'))
  with check (public.has_permission('enquiries.write'));

-- ---------------------------------------------------------------------
-- Catalogue
--
-- Reads on most of these are already public (a shop has to render), so
-- catalog.read matters only for the unpublished rows the storefront
-- policies hide. catalog.write is the substantive grant.

create policy "Products are readable with catalog.read"
  on public.products for select using (public.has_permission('catalog.read'));
create policy "Products are managed with catalog.write"
  on public.products for all
  using (public.has_permission('catalog.write'))
  with check (public.has_permission('catalog.write'));

create policy "Product images are managed with catalog.write"
  on public.product_images for all
  using (public.has_permission('catalog.write'))
  with check (public.has_permission('catalog.write'));
create policy "Product collections are managed with catalog.write"
  on public.product_collections for all
  using (public.has_permission('catalog.write'))
  with check (public.has_permission('catalog.write'));
create policy "Product occasions are managed with catalog.write"
  on public.product_occasions for all
  using (public.has_permission('catalog.write'))
  with check (public.has_permission('catalog.write'));

create policy "Collections are readable with catalog.read"
  on public.collections for select using (public.has_permission('catalog.read'));
create policy "Collections are managed with catalog.write"
  on public.collections for all
  using (public.has_permission('catalog.write'))
  with check (public.has_permission('catalog.write'));

create policy "Categories are managed with catalog.write"
  on public.categories for all
  using (public.has_permission('catalog.write'))
  with check (public.has_permission('catalog.write'));
create policy "Occasions are managed with catalog.write"
  on public.occasions for all
  using (public.has_permission('catalog.write'))
  with check (public.has_permission('catalog.write'));
create policy "Media is managed with catalog.write"
  on public.media for all
  using (public.has_permission('catalog.write'))
  with check (public.has_permission('catalog.write'));

-- Builder option tables. Same grant, listed individually because there is
-- no shared parent to hang one policy on.
create policy "Fabrics are managed with catalog.write"
  on public.fabrics for all
  using (public.has_permission('catalog.write'))
  with check (public.has_permission('catalog.write'));
create policy "Colours are managed with catalog.write"
  on public.colours for all
  using (public.has_permission('catalog.write'))
  with check (public.has_permission('catalog.write'));
create policy "Necklines are managed with catalog.write"
  on public.necklines for all
  using (public.has_permission('catalog.write'))
  with check (public.has_permission('catalog.write'));
create policy "Sleeve styles are managed with catalog.write"
  on public.sleeve_styles for all
  using (public.has_permission('catalog.write'))
  with check (public.has_permission('catalog.write'));
create policy "Embroidery types are managed with catalog.write"
  on public.embroidery_types for all
  using (public.has_permission('catalog.write'))
  with check (public.has_permission('catalog.write'));
create policy "Dupatta options are managed with catalog.write"
  on public.dupatta_options for all
  using (public.has_permission('catalog.write'))
  with check (public.has_permission('catalog.write'));
create policy "Inspiration images are managed with catalog.write"
  on public.inspiration_images for all
  using (public.has_permission('catalog.write'))
  with check (public.has_permission('catalog.write'));
create policy "Builder option occasions are managed with catalog.write"
  on public.builder_option_occasions for all
  using (public.has_permission('catalog.write'))
  with check (public.has_permission('catalog.write'));

-- ---------------------------------------------------------------------
-- Content and SEO

create policy "Pages are managed with content.write"
  on public.pages for all
  using (public.has_permission('content.write'))
  with check (public.has_permission('content.write'));
create policy "Blog posts are managed with content.write"
  on public.blog_posts for all
  using (public.has_permission('content.write'))
  with check (public.has_permission('content.write'));
create policy "FAQs are managed with content.write"
  on public.faqs for all
  using (public.has_permission('content.write'))
  with check (public.has_permission('content.write'));
create policy "SEO metadata is managed with content.write"
  on public.seo_metadata for all
  using (public.has_permission('content.write'))
  with check (public.has_permission('content.write'));
create policy "Social gallery images are managed with content.write"
  on public.social_gallery_images for all
  using (public.has_permission('content.write'))
  with check (public.has_permission('content.write'));

-- ---------------------------------------------------------------------
-- Marketing

create policy "Campaigns are managed with marketing.write"
  on public.campaigns for all
  using (public.has_permission('marketing.write'))
  with check (public.has_permission('marketing.write'));
create policy "Coupons are managed with marketing.write"
  on public.coupons for all
  using (public.has_permission('marketing.write'))
  with check (public.has_permission('marketing.write'));
create policy "Promotional banners are managed with marketing.write"
  on public.promotional_banners for all
  using (public.has_permission('marketing.write'))
  with check (public.has_permission('marketing.write'));
create policy "Newsletter subscribers are readable with marketing.write"
  on public.newsletter_subscribers for select using (public.has_permission('marketing.write'));
create policy "Email deliveries are readable with marketing.write"
  on public.email_deliveries for select using (public.has_permission('marketing.write'));

-- ---------------------------------------------------------------------
-- Reviews

create policy "Reviews are readable with reviews.moderate"
  on public.reviews for select using (public.has_permission('reviews.moderate'));
create policy "Reviews are updatable with reviews.moderate"
  on public.reviews for update using (public.has_permission('reviews.moderate'));
create policy "Reviews are deletable with reviews.moderate"
  on public.reviews for delete using (public.has_permission('reviews.moderate'));
create policy "Review media is readable with reviews.moderate"
  on public.review_media for select using (public.has_permission('reviews.moderate'));
create policy "Review media is deletable with reviews.moderate"
  on public.review_media for delete using (public.has_permission('reviews.moderate'));

-- ---------------------------------------------------------------------
-- Analytics

create policy "Analytics events are readable with analytics.read"
  on public.analytics_events for select using (public.has_permission('analytics.read'));

-- ---------------------------------------------------------------------
-- Settings
--
-- Only super_admin and admin hold settings.manage today, and both already
-- satisfy is_admin(). This policy exists so that granting settings.manage
-- to another role in Admin -> Team actually works, rather than silently
-- doing nothing.

create policy "Site settings are managed with settings.manage"
  on public.site_settings for all
  using (public.has_permission('settings.manage'))
  with check (public.has_permission('settings.manage'));
