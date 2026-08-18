-- Module 1: lookup/reference seed data only — enough for the Module 6
-- builder to have real options to render. Full demo storefront content
-- (products, collections, blog posts, reviews) is Module 31's job.

insert into public.categories (name, slug, description, sort_order) values
  ('Bridal Lehengas', 'bridal-lehengas', 'Statement pieces for the wedding day.', 1),
  ('Party Wear', 'party-wear', 'Occasion-ready lehengas for celebrations.', 2),
  ('Engagement Collection', 'engagement-collection', 'Refined designs for engagements and receptions.', 3)
on conflict (slug) do nothing;

insert into public.fabrics (name, slug, description, price_adjustment, sort_order) values
  ('Silk', 'silk', 'Classic, structured silk base.', 0, 1),
  ('Velvet', 'velvet', 'Rich, heavyweight velvet.', 45, 2),
  ('Net', 'net', 'Lightweight layered net.', 20, 3),
  ('Organza', 'organza', 'Crisp, sheer organza.', 25, 4),
  ('Georgette', 'georgette', 'Soft, flowing georgette.', 15, 5)
on conflict (slug) do nothing;

insert into public.embroidery_types (name, slug, description, price_adjustment, sort_order) values
  ('Zardozi', 'zardozi', 'Traditional metallic thread embroidery.', 120, 1),
  ('Dabka', 'dabka', 'Fine coiled-wire embroidery.', 90, 2),
  ('Sequin Work', 'sequin-work', 'All-over sequin embellishment.', 60, 3),
  ('Thread Embroidery', 'thread-embroidery', 'Classic thread needlework.', 40, 4),
  ('Mirror Work', 'mirror-work', 'Traditional mirror embellishment.', 55, 5)
on conflict (slug) do nothing;

insert into public.colours (name, slug, hex_value, sort_order) values
  ('Maroon', 'maroon', '#800000', 1),
  ('Emerald Green', 'emerald-green', '#046307', 2),
  ('Royal Blue', 'royal-blue', '#002366', 3),
  ('Blush Pink', 'blush-pink', '#F9CEDF', 4),
  ('Ivory', 'ivory', '#FFFFF0', 5),
  ('Gold', 'gold', '#D4AF37', 6)
on conflict (slug) do nothing;

insert into public.sleeve_styles (name, slug, sort_order) values
  ('Full Sleeves', 'full-sleeves', 1),
  ('Half Sleeves', 'half-sleeves', 2),
  ('Sleeveless', 'sleeveless', 3),
  ('Cap Sleeves', 'cap-sleeves', 4)
on conflict (slug) do nothing;

insert into public.necklines (name, slug, sort_order) values
  ('Sweetheart', 'sweetheart', 1),
  ('Boat Neck', 'boat-neck', 2),
  ('V-Neck', 'v-neck', 3),
  ('High Neck', 'high-neck', 4)
on conflict (slug) do nothing;

insert into public.dupatta_options (name, slug, price_adjustment, sort_order) values
  ('Net Dupatta', 'net-dupatta', 0, 1),
  ('Embroidered Dupatta', 'embroidered-dupatta', 35, 2),
  ('Plain Silk Dupatta', 'plain-silk-dupatta', 15, 3),
  ('No Dupatta', 'no-dupatta', 0, 4)
on conflict (slug) do nothing;
