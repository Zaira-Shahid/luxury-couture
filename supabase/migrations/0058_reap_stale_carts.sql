-- Module 29 — reap abandoned anonymous carts.
--
-- THE PROBLEM. Middleware issues a `cart_session` cookie to every
-- visitor, and get_or_create_cart() writes a carts row for it on the
-- first page render. So one anonymous HTTP request creates a database
-- row, with no rate limit and no cleanup. The security audit found 952
-- ownerless carts in a development database that has never seen real
-- traffic — a crawler or a trivial loop grows that table without bound.
--
-- WHAT IS SAFE TO DELETE, stated precisely, because this is a
-- destructive job and "old cart" is doing a lot of work in that phrase:
--
--   * customer_id IS NULL      — never belonged to a signed-in customer,
--                                so nobody can come back and find it.
--   * status = 'active'        — never converted to an order and never
--                                marked abandoned by Module 19's
--                                abandoned-cart flow, which owns those.
--   * no cart_items rows       — genuinely empty. A guest who put
--                                something in a basket is a sales lead;
--                                deleting that would be destroying
--                                business data to save a row.
--   * older than the cutoff    — a live session is never touched.
--
-- All four conditions must hold. The intersection is exactly "a row
-- created by a page view that never became anything", which is the thing
-- that accumulates.

create or replace function public.reap_stale_carts(p_older_than_hours integer default 72)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  with doomed as (
    select c.id
    from public.carts c
    where c.customer_id is null
      and c.status = 'active'
      and c.updated_at < now() - make_interval(hours => p_older_than_hours)
      and not exists (select 1 from public.cart_items ci where ci.cart_id = c.id)
  )
  delete from public.carts
  where id in (select id from doomed);

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

-- SECURITY DEFINER so the cron's service-role client and a future admin
-- tool get the same behaviour, but execute is revoked from the public
-- roles: this deletes rows, and nothing reachable from the browser has
-- any business calling it.
revoke all on function public.reap_stale_carts(integer) from public;
revoke all on function public.reap_stale_carts(integer) from anon;
revoke all on function public.reap_stale_carts(integer) from authenticated;

-- Makes the cutoff scan an index seek rather than a sequential scan once
-- this table is large — which is the situation the function exists for.
create index if not exists carts_anonymous_stale_idx
  on public.carts (updated_at)
  where customer_id is null and status = 'active';
