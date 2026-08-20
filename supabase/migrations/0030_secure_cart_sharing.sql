-- Module 10: close a fourth instance of the guest-scan leak pattern found
-- in Modules 5 (enquiries, 0021), 6 (builder_configurations/
-- inspiration_images, 0022), and 9 (appointments, 0028) — carts' own
-- migration comment (0005, Module 1) predicted this one too: "Guest carts
-- (customer_id null) are keyed by a client-held session_id, the same
-- obscurity pattern as builder_configurations.share_token — Module 10
-- (checkout) can harden this further when it lands." Confirmed live
-- before fixing: a guest cart's session_id was fully readable, via a
-- blind table scan, from a completely unrelated anonymous session.
--
-- Same fix shape as 0022: lock RLS to owner-or-admin, add SECURITY
-- DEFINER RPCs that require session_id for the guest path. Unlike
-- builder_configurations (id+token in a shareable URL), a cart's
-- session_id lives in a cookie, not the URL — carts aren't naturally
-- "shareable" the way a design is.

drop policy "Carts are usable by their owner, guest session, or admin"
  on public.carts;

create policy "Carts are usable by their owner or admin"
  on public.carts for all
  using (customer_id = auth.uid() or public.is_admin())
  with check (customer_id = auth.uid() or public.is_admin());

drop policy "Cart items follow their cart's visibility"
  on public.cart_items;

create policy "Cart items follow their cart's visibility"
  on public.cart_items for all
  using (
    exists (
      select 1 from public.carts c
      where c.id = cart_id and (c.customer_id = auth.uid() or public.is_admin())
    )
  )
  with check (
    exists (
      select 1 from public.carts c
      where c.id = cart_id and (c.customer_id = auth.uid() or public.is_admin())
    )
  );

-- ---- Cart RPCs (session-id-gated for guests, auth.uid() takes priority) --

-- Signed-in callers always get their account cart, regardless of what
-- session_id is passed — the cookie becomes irrelevant once signed in,
-- rather than creating a second, orphaned session-scoped cart.
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
    select * into result from public.carts
    where customer_id = auth.uid() and status = 'active'
    limit 1;

    if result.id is null then
      insert into public.carts (customer_id) values (auth.uid())
      returning * into result;
    end if;
  else
    if p_session_id is null then
      raise exception 'A session id is required for a guest cart.';
    end if;

    select * into result from public.carts
    where session_id = p_session_id::text and status = 'active'
    limit 1;

    if result.id is null then
      insert into public.carts (session_id) values (p_session_id::text)
      returning * into result;
    end if;
  end if;

  return result;
end;
$$;

create or replace function public.get_cart_items(p_cart_id uuid, p_session_id uuid default null)
returns setof public.cart_items
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not exists (
    select 1 from public.carts
    where id = p_cart_id
      and (customer_id = auth.uid() or (auth.uid() is null and session_id = p_session_id::text))
  ) then
    raise exception 'Cart not found.';
  end if;

  return query select * from public.cart_items where cart_id = p_cart_id;
end;
$$;

-- p_unit_price is a client-supplied *display snapshot only* — matching
-- cart_items.unit_price_snapshot's own existing column comment from 0005.
-- Checkout (placeOrder) never trusts this for the real charge; it always
-- re-derives from products.base_price / builder_configurations.
-- estimated_price at order-creation time.
create or replace function public.add_cart_item(
  p_session_id uuid,
  p_product_id uuid default null,
  p_builder_configuration_id uuid default null,
  p_quantity integer default 1,
  p_unit_price numeric default 0
)
returns public.cart_items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cart public.carts;
  result public.cart_items;
begin
  if (p_product_id is not null)::int + (p_builder_configuration_id is not null)::int <> 1 then
    raise exception 'Provide exactly one of product_id or builder_configuration_id.';
  end if;

  -- Builder-configuration items require a signed-in owner: a guest cart
  -- has no token to prove ownership of the referenced design, and
  -- builder_configurations access itself is owner-or-admin-only post-0022
  -- unless claimed. Product items stay guest-friendly.
  if p_builder_configuration_id is not null then
    if auth.uid() is null then
      raise exception 'Sign in to add a custom design to your cart.';
    end if;
    if not exists (
      select 1 from public.builder_configurations
      where id = p_builder_configuration_id and customer_id = auth.uid()
    ) then
      raise exception 'That design was not found in your account.';
    end if;
  end if;

  v_cart := public.get_or_create_cart(p_session_id);

  if p_product_id is not null then
    select * into result from public.cart_items
    where cart_id = v_cart.id and product_id = p_product_id;
  end if;

  if result.id is not null then
    update public.cart_items
    set quantity = quantity + greatest(p_quantity, 1)
    where id = result.id
    returning * into result;
  else
    insert into public.cart_items (
      cart_id, product_id, builder_configuration_id, quantity, unit_price_snapshot
    ) values (
      v_cart.id, p_product_id, p_builder_configuration_id, greatest(p_quantity, 1), greatest(p_unit_price, 0)
    )
    returning * into result;
  end if;

  return result;
end;
$$;

create or replace function public.update_cart_item_quantity(
  p_item_id uuid,
  p_session_id uuid,
  p_quantity integer
)
returns public.cart_items
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.cart_items;
begin
  if p_quantity < 1 then
    raise exception 'Quantity must be at least 1.';
  end if;

  update public.cart_items ci
  set quantity = p_quantity
  from public.carts c
  where ci.id = p_item_id
    and ci.cart_id = c.id
    and (c.customer_id = auth.uid() or (auth.uid() is null and c.session_id = p_session_id::text))
  returning ci.* into result;

  if result.id is null then
    raise exception 'Cart item not found.';
  end if;

  return result;
end;
$$;

create or replace function public.remove_cart_item(p_item_id uuid, p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.cart_items ci
  using public.carts c
  where ci.id = p_item_id
    and ci.cart_id = c.id
    and (c.customer_id = auth.uid() or (auth.uid() is null and c.session_id = p_session_id::text));

  if not found then
    raise exception 'Cart item not found.';
  end if;
end;
$$;

grant execute on function public.get_or_create_cart(uuid) to anon, authenticated;
grant execute on function public.get_cart_items(uuid, uuid) to anon, authenticated;
grant execute on function public.add_cart_item(uuid, uuid, uuid, integer, numeric) to anon, authenticated;
grant execute on function public.update_cart_item_quantity(uuid, uuid, integer) to anon, authenticated;
grant execute on function public.remove_cart_item(uuid, uuid) to anon, authenticated;
