-- Category restructure: Asian Wear / Western Wear, occasions stay separate.
--
-- THE DECISION (taken with the owner, Option B of three):
--
--   categories = WHERE a product lives      -> Asian Wear | Western Wear
--   occasions  = WHAT a product is FOR      -> nikkah, baraat, mehndi, ...
--
-- The alternative was making Nikkah/Baraat/Reception/Mehndi/Engagement
-- child categories under Asian Wear. That was rejected because
-- `products.category_id` is a SINGLE foreign key, so it would force each
-- piece into exactly one event forever — and a lehenga genuinely can suit
-- both a mehndi and an engagement. `product_occasions` is many-to-many and
-- already models that correctly.
--
-- `categories.parent_id` exists and stays UNUSED. Option B is deliberately
-- flat; there is no tree to maintain.

-- ---------------------------------------------------------------------
-- Occasions: add the two that did not exist.
--
-- 0048 seeded bridal, mehndi, walima, reception, engagement and party.
-- Nikkah and Baraat are both distinct events in a South Asian wedding and
-- neither was represented.

insert into public.occasions (name, slug, description, sort_order)
values
  ('Nikkah', 'nikkah', 'The marriage ceremony itself.', 10),
  ('Baraat', 'baraat', 'The groom''s procession and arrival.', 11)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- The two categories.

insert into public.categories (name, slug, description, sort_order)
values
  (
    'Asian Wear',
    'asian-wear',
    'Lehengas, shararas, ghararas, anarkalis and sarees, made to measure.',
    1
  ),
  (
    'Western Wear',
    'western-wear',
    'Gowns and contemporary occasion pieces.',
    2
  )
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- The previous categories are RETIRED, not deleted.
--
-- products.category_id is `on delete set null`, so dropping these rows
-- would silently orphan any product still pointing at one — including a
-- real product an owner had created. Flipping is_active hides them from
-- the storefront, is reversible, and breaks nothing.

update public.categories
set is_active = false
where slug in ('bridal-lehengas', 'party-wear', 'engagement-collection', 'ready-to-wear');
