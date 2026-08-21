-- Module 19 Pass 2: abandoned-cart detection.
--
-- carts.updated_at is NOT a usable "last real activity" signal — found
-- while designing this function, not assumed. get_or_create_cart (0032)
-- bumps it via ON CONFLICT DO UPDATE ... SET updated_at = now() on every
-- call, and getCartItemCount() (src/lib/cart/get-cart.ts) calls it on
-- every single page view via SiteHeader, site-wide — a customer who never
-- touches their cart again but keeps browsing other pages would look
-- perpetually "active" forever. cart_items.updated_at only changes when
-- an item is actually added/updated/removed, so that's the real signal —
-- expressed as an aggregate (MAX per cart, HAVING a minimum item count),
-- which is naturally a SQL function rather than something to assemble
-- through the Supabase JS client's filter API.
create or replace function public.find_and_mark_abandoned_carts(p_hours integer default 24)
returns table(cart_id uuid, customer_id uuid)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with stale as (
    select c.id, c.customer_id
    from public.carts c
    join public.cart_items ci on ci.cart_id = c.id
    where c.status = 'active'
    group by c.id, c.customer_id
    having max(ci.updated_at) < now() - (p_hours || ' hours')::interval
  )
  update public.carts
  set status = 'abandoned'
  from stale
  where carts.id = stale.id
  returning carts.id, stale.customer_id;
end;
$$;
