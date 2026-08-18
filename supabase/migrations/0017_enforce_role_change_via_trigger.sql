-- Module 2 fix: enforce "customers can't change their own role" with a
-- trigger, since a column-level REVOKE cannot do it.
--
-- Discovered via scripts/verify-cross-user.mjs, still failing after 0016:
-- Postgres column-level privileges are *additive* on top of table-level
-- grants, never restrictive. `revoke update (role) on profiles from
-- authenticated` (0001, re-applied in 0016) has no effect once
-- `grant update on all tables ... to authenticated` (0014) exists at the
-- table level — the table-level grant already covers every column,
-- including role, and a column-level REVOKE cannot carve an exception out
-- of it. Confirmed empirically: information_schema.column_privileges still
-- showed authenticated with UPDATE on profiles.role after 0016 applied
-- cleanly. The standard fix for "can update own row but not this column"
-- under a blanket table-level grant is a trigger, not a column GRANT/REVOKE.
--
-- service_role and postgres are exempted (current_user check) since both
-- are trusted server-side/admin contexts with no JWT-based auth.uid() to
-- evaluate is_admin() against.
create or replace function public.prevent_role_self_promotion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and not public.is_admin()
     and current_user not in ('service_role', 'postgres') then
    raise exception 'permission denied: cannot change role';
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_role_self_promotion
  before update on public.profiles
  for each row execute function public.prevent_role_self_promotion();
