-- Module 31 — a manifest of everything the demo seeder created.
--
-- WHY A TABLE AND NOT A SLUG PREFIX. The obvious way to make demo data
-- removable is to prefix every slug with "demo-", but slugs are
-- customer-visible URLs and a demo store called /products/demo-crimson-
-- lehenga does not look like a real shop, which defeats the point of
-- having one.
--
-- WHY NOT A FILE. A manifest on disk is lost the moment someone clones
-- the repo fresh or runs the seeder from CI, and then --clear has no idea
-- what it may delete. It would have to fall back on guessing, and a
-- delete that guesses is exactly what must never happen here.
--
-- So the manifest lives beside the data it describes. --clear deletes
-- precisely these rows and can never touch real business data: a real
-- product has no manifest entry, so it is not a candidate at all.
--
-- The TABLE is infrastructure and belongs in a migration. The DATA it
-- tracks is demo content and belongs in a script you can run and undo —
-- a migration that inserts demo products is either permanent or needs a
-- second migration to reverse it.

create table public.demo_seed_items (
  id uuid primary key default gen_random_uuid(),
  -- Not a foreign key: this deliberately points at many different
  -- tables, and rows are deleted in dependency order by the seeder.
  entity_table text not null,
  entity_id uuid not null,
  -- Free-text note for anything a human needs when auditing, e.g. the
  -- storage object path for a generated image.
  detail text,
  created_at timestamptz not null default now(),
  unique (entity_table, entity_id)
);

create index demo_seed_items_table_idx on public.demo_seed_items (entity_table);

alter table public.demo_seed_items enable row level security;

-- Admin-readable so the demo store's footprint is auditable from the
-- admin area. Writes happen only through the seeder, which uses the
-- service-role client and bypasses RLS — and a table with RLS enabled
-- and no write policy denies by default.
create policy "Demo seed manifest is readable by admin"
  on public.demo_seed_items for select
  using (public.is_admin());
