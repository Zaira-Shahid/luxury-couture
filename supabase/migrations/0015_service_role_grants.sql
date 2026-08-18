-- Module 2 fix: base table privileges for service_role.
--
-- Discovered while verifying Module 2 auth flows: a service_role query
-- against public.profiles failed with "permission denied for table
-- profiles" (SQLSTATE 42501). service_role has BYPASSRLS, but RLS bypass
-- and Postgres table GRANTs are separate permission layers — bypassing RLS
-- doesn't imply an implicit GRANT. 0014_grants.sql only covered
-- anon/authenticated, not service_role, because that gap wasn't exercised
-- until src/lib/supabase/admin.ts (or a verification script using the
-- service-role key) actually queried a table.
grant usage on schema public to service_role;

grant select, insert, update, delete
  on all tables in schema public
  to service_role;

grant usage, select on all sequences in schema public to service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;

alter default privileges in schema public
  grant usage, select on sequences to service_role;
