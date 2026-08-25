-- Retire the Walima and Party occasions.
--
-- THE DECISION (owner, 2026-08-24): "walima aur party wala section remove
-- kr do" — the storefront should offer neither as a browsable occasion.
-- Nikkah and Mehndi keep everything already attached to them; further
-- imagery for the remaining occasions is coming from the owner directly.
--
-- RETIRED, NOT DELETED — the same call 0061 made for the old categories,
-- for the same reason plus one more:
--
--   * `product_occasions.occasion_id` is `on delete cascade`, so dropping
--     these two rows would silently destroy 8 tagging rows across 7
--     products. Flipping `is_active` throws nothing away.
--   * 0048 also seeded `colour_occasions`, `fabric_occasions` and
--     `embroidery_occasions` rows pointing at walima and party. Those feed
--     the builder's "popular for …" hints; they too would cascade away.
--   * It is reversible with a one-line update if the owner wants either
--     back.
--
-- NOTHING IN THE APP NEEDS CHANGING. Every read path already filters on
-- is_active, so this migration alone is the whole removal:
--
--   * get-occasions.ts  — getActiveOccasions() and the builder-hint join
--                         (`occasions!inner(... is_active ...)`) both
--                         require is_active.
--   * get-products.ts   — the ?occasion= filter resolves the slug with
--                         `.eq("is_active", true)` and returns [] when it
--                         misses, so a hand-typed /products?occasion=party
--                         URL shows nothing rather than a hidden section.
--   * /api/chat         — builds its vocabulary from getActiveOccasions(),
--                         so the assistant stops offering them as well.
--                         (The OCCASION_SYNONYMS entries in
--                         query-intent.ts become dead keys; harmless, and
--                         left in place so re-activation is one update.)

update public.occasions
set is_active = false
where slug in ('walima', 'party');
