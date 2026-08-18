-- Module 1: extensions and shared helpers used by every later migration.

create extension if not exists pgcrypto;

-- Shared updated_at trigger, reused by every table that has the column.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Checks whether the current JWT belongs to an admin, for use in RLS
-- policies. SECURITY DEFINER so it can read public.profiles without
-- recursing into that table's own RLS policies.
--
-- language plpgsql (not sql): a `language sql` function body is parsed and
-- validated against the catalog at CREATE FUNCTION time, but public.profiles
-- doesn't exist until 0001 runs — this file intentionally runs first (it's
-- 0000) so every later migration can reference is_admin(). plpgsql defers
-- validation to first execution instead, which is what makes that ordering
-- possible. (Confirmed the hard way: the `sql`-language version failed with
-- "relation public.profiles does not exist" the first time this migration
-- set was actually run, since it had never been applied before.)
create or replace function public.is_admin()
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
end;
$$;

-- Auto-creates a profiles row whenever a new auth user signs up, so
-- application code never has to remember to do it (and can't forget to,
-- since client inserts into profiles are not permitted by RLS).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
