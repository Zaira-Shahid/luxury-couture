-- Module 23: occasions taxonomy.
--
-- Noted as a gap at the end of Module 22 and confirmed while planning
-- this one: nothing in the catalogue expressed WHAT a piece is for.
-- Products carried only category, collection and price, so "something
-- for a mehndi" had no data to resolve against.
--
-- Two join tables rather than one because the two sides differ:
-- products are a single table, while builder options span six
-- (fabrics, colours, embroidery_types, sleeve_styles, necklines,
-- dupatta_options). The builder side is therefore polymorphic on
-- (table, id), the same shape seo_metadata (0011) uses — a real FK per
-- option table would mean six nullable columns and a check constraint.

create table public.occasions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_occasions_updated_at
  before update on public.occasions
  for each row execute function public.set_updated_at();

alter table public.occasions enable row level security;

-- Same "active is public, everything is admin" shape as faqs (0045).
create policy "Active occasions are publicly readable"
  on public.occasions for select
  using (is_active or public.is_admin());
create policy "Occasions are managed by admin"
  on public.occasions for insert with check (public.is_admin());
create policy "Occasions are updated by admin"
  on public.occasions for update using (public.is_admin());
create policy "Occasions are deleted by admin"
  on public.occasions for delete using (public.is_admin());

--------------------------------------------------------------------------------

create table public.product_occasions (
  product_id uuid not null references public.products (id) on delete cascade,
  occasion_id uuid not null references public.occasions (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (product_id, occasion_id)
);

create index product_occasions_occasion_idx on public.product_occasions (occasion_id);

alter table public.product_occasions enable row level security;

-- Public read: this drives storefront discovery. It reveals only which
-- product belongs to which occasion, and products' own RLS still governs
-- whether the product itself is visible.
create policy "Product occasions are publicly readable"
  on public.product_occasions for select using (true);
create policy "Product occasions are managed by admin"
  on public.product_occasions for all
  using (public.is_admin()) with check (public.is_admin());

--------------------------------------------------------------------------------

create table public.builder_option_occasions (
  -- One of BUILDER_OPTION_TABLES (src/types/database.ts). Constrained
  -- here as well as in the app so a typo cannot create a row nothing
  -- will ever read back.
  option_table text not null check (
    option_table in (
      'fabrics', 'embroidery_types', 'colours',
      'sleeve_styles', 'necklines', 'dupatta_options'
    )
  ),
  option_id uuid not null,
  occasion_id uuid not null references public.occasions (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (option_table, option_id, occasion_id)
);

create index builder_option_occasions_occasion_idx
  on public.builder_option_occasions (occasion_id);

alter table public.builder_option_occasions enable row level security;

create policy "Builder option occasions are publicly readable"
  on public.builder_option_occasions for select using (true);
create policy "Builder option occasions are managed by admin"
  on public.builder_option_occasions for all
  using (public.is_admin()) with check (public.is_admin());

--------------------------------------------------------------------------------
-- Seed: the occasions a UK South Asian bridal house actually sells into.
-- All editable and deletable in Admin → Content — these are a starting
-- point for the owner, not fixed configuration.

insert into public.occasions (name, slug, description, sort_order) values
  ('Bridal',     'bridal',     'The main wedding day — the most heavily worked pieces.', 0),
  ('Mehndi',     'mehndi',     'Bright, lighter pieces for the mehndi celebration.',     1),
  ('Walima',     'walima',     'Softer, elegant pieces for the walima reception.',       2),
  ('Reception',  'reception',  'Statement pieces for an evening reception.',             3),
  ('Engagement', 'engagement', 'Refined pieces for an engagement.',                      4),
  ('Party',      'party',      'Lighter occasion wear for parties and events.',          5);

-- Default colour and fabric links, joined by slug so this seed cannot
-- create dangling rows if the builder seed ever changes.
insert into public.builder_option_occasions (option_table, option_id, occasion_id)
select 'colours', c.id, o.id
from (values
  ('maroon', 'bridal'), ('maroon', 'reception'),
  ('emerald-green', 'mehndi'), ('emerald-green', 'party'),
  ('royal-blue', 'reception'), ('royal-blue', 'party'),
  ('blush-pink', 'walima'), ('blush-pink', 'engagement'),
  ('ivory', 'walima'), ('ivory', 'engagement'),
  ('gold', 'bridal'), ('gold', 'reception')
) as v(colour_slug, occasion_slug)
join public.colours c on c.slug = v.colour_slug
join public.occasions o on o.slug = v.occasion_slug
on conflict do nothing;

insert into public.builder_option_occasions (option_table, option_id, occasion_id)
select 'fabrics', f.id, o.id
from (values
  ('silk', 'bridal'), ('silk', 'walima'),
  ('velvet', 'bridal'), ('velvet', 'reception'),
  ('net', 'mehndi'), ('net', 'party'),
  ('organza', 'engagement'), ('organza', 'party'),
  ('georgette', 'mehndi'), ('georgette', 'walima')
) as v(fabric_slug, occasion_slug)
join public.fabrics f on f.slug = v.fabric_slug
join public.occasions o on o.slug = v.occasion_slug
on conflict do nothing;

insert into public.builder_option_occasions (option_table, option_id, occasion_id)
select 'embroidery_types', e.id, o.id
from (values
  ('zardozi', 'bridal'), ('dabka', 'bridal'),
  ('sequin-work', 'reception'), ('sequin-work', 'party'),
  ('mirror-work', 'mehndi'), ('thread-embroidery', 'engagement')
) as v(embroidery_slug, occasion_slug)
join public.embroidery_types e on e.slug = v.embroidery_slug
join public.occasions o on o.slug = v.occasion_slug
on conflict do nothing;
