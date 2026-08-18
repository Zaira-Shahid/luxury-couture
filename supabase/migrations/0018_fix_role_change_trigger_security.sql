-- Module 2 fix: 0017's trigger never actually fired its block.
--
-- Discovered via a temporary debug RPC comparing current_user inside a
-- SECURITY DEFINER function vs. a SECURITY INVOKER one: inside a SECURITY
-- DEFINER function, `current_user` resolves to the function's *owner*
-- (`postgres`, since that's who ran the migrations), not the actual
-- caller. 0017's trigger checked `current_user not in ('service_role',
-- 'postgres')` intending to exempt only trusted server-side callers, but
-- because of SECURITY DEFINER every caller's `current_user` read as
-- 'postgres' inside the function body — so the exemption matched
-- everyone, and the block never ran. Confirmed via
-- scripts/verify-cross-user.mjs: a customer could still self-promote to
-- admin after 0017.
--
-- Fix: SECURITY INVOKER (the default) instead, so current_user correctly
-- reflects the actual PostgREST-assigned role for the request
-- ('authenticated' for a real customer, 'service_role' for server-side
-- calls — confirmed empirically for both). is_admin() is still
-- SECURITY DEFINER internally, so it still works correctly when called
-- from here regardless of the caller's own RLS visibility into profiles.
create or replace function public.prevent_role_self_promotion()
returns trigger
language plpgsql
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

drop function if exists public.debug_role_check();
