-- Module 10 fix: get_or_create_cart's SELECT-then-INSERT pattern isn't
-- atomic. Discovered via the verify-then-cleanup discipline itself — a
-- test run left two cart rows sharing the identical session_id, which
-- shouldn't be possible. Root cause: SiteHeader (getCartItemCount) and a
-- page like /cart (getCart) both call get_or_create_cart with the same
-- session_id concurrently within the same request's render — Next.js
-- parallelizes independent data fetches across components, so both calls
-- can pass the "no active cart found" check before either INSERT commits,
-- creating two rows for what should be one cart.
--
-- Fix: partial unique indexes (one active cart per guest session, one per
-- signed-in customer) plus INSERT ... ON CONFLICT ... DO UPDATE, so
-- concurrent calls resolve to the same row atomically instead of racing.
create unique index carts_active_session_id_idx
  on public.carts (session_id)
  where status = 'active' and customer_id is null;

create unique index carts_active_customer_id_idx
  on public.carts (customer_id)
  where status = 'active' and customer_id is not null;

create or replace function public.get_or_create_cart(p_session_id uuid default null)
returns public.carts
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.carts;
begin
  if auth.uid() is not null then
    insert into public.carts (customer_id)
    values (auth.uid())
    on conflict (customer_id) where status = 'active' and customer_id is not null
    do update set updated_at = now()
    returning * into result;
  else
    if p_session_id is null then
      raise exception 'A session id is required for a guest cart.';
    end if;

    insert into public.carts (session_id)
    values (p_session_id::text)
    on conflict (session_id) where status = 'active' and customer_id is null
    do update set updated_at = now()
    returning * into result;
  end if;

  return result;
end;
$$;
