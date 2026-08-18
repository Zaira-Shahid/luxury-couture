-- Module 1 fix: base table privileges for anon/authenticated.
--
-- Discovered by actually testing the anon key against the live database
-- after applying 0000-0013 (not by reading the files): every query failed
-- with "permission denied for table X" / SQLSTATE 42501, even for tables
-- whose RLS policy should have allowed a public read (e.g. fabrics,
-- categories). Postgres itself explained why: RLS policies only apply
-- *after* a role already has the base GRANT for that operation — none of
-- 0000-0013 ever granted anon/authenticated anything beyond the schema
-- defaults (REFERENCES/TRIGGER/TRUNCATE), so RLS never even got a chance
-- to run. This is the standard Supabase pattern: grant broadly at the role
-- level, let RLS do the actual access control per-row.
--
-- `alter default privileges` covers every table later migrations create
-- too, so 0015+ don't need to repeat this.
grant usage on schema public to anon, authenticated;

grant select, insert, update, delete
  on all tables in schema public
  to anon, authenticated;

grant usage, select on all sequences in schema public to anon, authenticated;

alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;

alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated;

-- The blanket table grant above also reaches public.schema_migrations
-- (this project's own migration-tracking table, created by
-- scripts/migrate.mjs — not part of the application's 45-table domain
-- schema). It has no RLS policy of its own, so without this it would be
-- the one table anon/authenticated could read and write with zero
-- restriction. Lock it down the same way every real table in this schema
-- is locked down, rather than carving out a silent exception to "every
-- table has RLS".
alter table public.schema_migrations enable row level security;

create policy "schema_migrations is admin-only"
  on public.schema_migrations for all
  using (public.is_admin())
  with check (public.is_admin());
