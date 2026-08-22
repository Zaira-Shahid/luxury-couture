-- Module 25 Pass 2: tax on orders.
--
-- Correction to an assumption made while planning: `orders.deposit_amount`
-- ALREADY EXISTS (0007) and is already populated by the quotation-
-- acceptance flow, which creates a 'deposit' payment when a quote carries
-- one. What was missing is a deposit rule for the CART CHECKOUT path,
-- where placeOrder always created a single 'full' payment — that is
-- application logic, not a schema change.
--
-- Tax genuinely did not exist anywhere, so it needs a column.
--
-- The tax RULE lives in site_settings (store.tax_rate,
-- store.tax_inclusive) because it is configuration. This column records
-- what was actually APPLIED to each order, which must be immutable:
-- changing the rate next year must not retroactively restate a
-- historical invoice.

alter table public.orders
  add column tax_amount numeric(10, 2) not null default 0 check (tax_amount >= 0);

comment on column public.orders.tax_amount is
  'Tax applied at order time. Immutable: a later settings change must not restate a historical order.';
