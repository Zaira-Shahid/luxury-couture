-- Module 19 Pass 1: coupons/discounts, loyalty points, referrals.

alter table public.orders
  add column discount_amount numeric(10, 2) not null default 0 check (discount_amount >= 0),
  add column coupon_id uuid references public.coupons (id) on delete set null,
  add column loyalty_points_redeemed integer not null default 0 check (loyalty_points_redeemed >= 0);

--------------------------------------------------------------------------------
-- Coupons
--------------------------------------------------------------------------------

-- Pure validity/amount logic, shared by validate_coupon (read-only preview)
-- and redeem_coupon (the atomic, consuming version actually called from
-- placeOrder) so the two RPCs can never drift out of sync with each other.
create or replace function public.compute_coupon_discount(p_coupon public.coupons, p_subtotal numeric)
returns numeric
language plpgsql
as $$
begin
  if not p_coupon.is_active then
    raise exception 'This coupon is no longer active.';
  end if;
  if p_coupon.starts_at is not null and now() < p_coupon.starts_at then
    raise exception 'This coupon is not active yet.';
  end if;
  if p_coupon.expires_at is not null and now() > p_coupon.expires_at then
    raise exception 'This coupon has expired.';
  end if;
  if p_coupon.max_uses is not null and p_coupon.used_count >= p_coupon.max_uses then
    raise exception 'This coupon has reached its usage limit.';
  end if;
  if p_coupon.min_order_amount is not null and p_subtotal < p_coupon.min_order_amount then
    raise exception 'This order does not meet the minimum amount for this coupon.';
  end if;

  if p_coupon.type = 'percentage' then
    return least(round(p_subtotal * p_coupon.value / 100, 2), p_subtotal);
  else
    return least(p_coupon.value, p_subtotal);
  end if;
end;
$$;

-- Read-only preview for the checkout UI's "Apply" button — no coupons
-- table read policy exists for customers (0010's own design, "codes can't
-- be scraped wholesale"), so this SECURITY DEFINER function is the only
-- way a customer session can check a code at all. Never consumes a use;
-- placeOrder re-validates via redeem_coupon at actual order creation,
-- since a previewed amount is never trusted as final (same "never trust
-- client-submitted prices" discipline as everywhere else in checkout).
create or replace function public.validate_coupon(p_code text, p_subtotal numeric)
returns numeric
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_coupon public.coupons;
begin
  select * into v_coupon from public.coupons where code = p_code;
  if v_coupon is null then
    raise exception 'Invalid coupon code.';
  end if;
  return public.compute_coupon_discount(v_coupon, p_subtotal);
end;
$$;

-- The atomic, consuming version — locks the coupon row (for update) so
-- concurrent checkouts against a limited-use coupon can't both succeed
-- past its max_uses, same race-safety discipline as get_or_create_cart
-- (0032). Increments used_count in the same statement as validation.
create or replace function public.redeem_coupon(p_code text, p_subtotal numeric)
returns table(coupon_id uuid, discount_amount numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coupon public.coupons;
  v_discount numeric;
begin
  select * into v_coupon from public.coupons where code = p_code for update;
  if v_coupon is null then
    raise exception 'Invalid coupon code.';
  end if;

  v_discount := public.compute_coupon_discount(v_coupon, p_subtotal);

  update public.coupons set used_count = used_count + 1 where id = v_coupon.id;

  return query select v_coupon.id, v_discount;
end;
$$;

--------------------------------------------------------------------------------
-- Loyalty points
--------------------------------------------------------------------------------

-- loyalty_accounts is never auto-created anywhere today (0010) — extend
-- handle_new_user() the same way Module 15 added the welcome notification
-- insert to the same trigger, so every signup gets one from day one.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');

  insert into public.notifications (profile_id, type, title, body, channel)
  values (
    new.id,
    'account_created',
    'Welcome to Luxury Lehenga Couture',
    'Your account has been created. Explore our collections or start designing a custom lehenga whenever you''re ready.',
    'in_app'
  );

  insert into public.loyalty_accounts (customer_id, points_balance)
  values (new.id, 0);

  return new;
end;
$$;

-- points is always stored with its own correct sign (earn positive,
-- redeem negative, adjust either) so points_balance is always just the
-- running sum — no type-based conditional needed anywhere at read time.
--
-- Idempotent via p_reference: a webhook retry calling this again with the
-- same reference (e.g. 'payment:<uuid>') is a no-op rather than double-
-- awarding points, matching the idempotency discipline already
-- established for payment/order recomputation (0011's
-- updateOrderAfterPayment).
create or replace function public.earn_loyalty_points(p_customer_id uuid, p_points integer, p_reference text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_id uuid;
begin
  if p_reference is not null and exists (
    select 1 from public.loyalty_transactions where reference = p_reference
  ) then
    return;
  end if;

  insert into public.loyalty_accounts (customer_id, points_balance)
  values (p_customer_id, 0)
  on conflict (customer_id) do nothing;

  select id into v_account_id from public.loyalty_accounts where customer_id = p_customer_id;

  insert into public.loyalty_transactions (loyalty_account_id, type, points, reference)
  values (v_account_id, 'earn', p_points, p_reference);

  update public.loyalty_accounts set points_balance = points_balance + p_points where id = v_account_id;
end;
$$;

-- Checkout-time redemption. Locks the account row so two concurrent
-- redemption attempts (e.g. two tabs) can't both succeed past the actual
-- balance.
create or replace function public.redeem_loyalty_points(p_customer_id uuid, p_points integer, p_reference text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account public.loyalty_accounts;
begin
  select * into v_account from public.loyalty_accounts where customer_id = p_customer_id for update;
  if v_account is null or v_account.points_balance < p_points then
    raise exception 'Not enough points available.';
  end if;

  insert into public.loyalty_transactions (loyalty_account_id, type, points, reference)
  values (v_account.id, 'redeem', -p_points, p_reference);

  update public.loyalty_accounts set points_balance = points_balance - p_points where id = v_account.id;
end;
$$;

--------------------------------------------------------------------------------
-- Referrals
--------------------------------------------------------------------------------

-- referrals' own RLS (0010) only lets the REFERRER insert/read their own
-- row, and only admin can update — the referred person has no way to
-- touch it themselves under existing RLS at all. This SECURITY DEFINER
-- function is the narrow, one-purpose exception: link a code to whoever
-- signs up with it, nothing else.
create or replace function public.redeem_referral_code(p_code text, p_referred_customer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referral public.referrals;
begin
  select * into v_referral from public.referrals where code = p_code for update;
  if v_referral is null then
    raise exception 'Invalid referral code.';
  end if;
  if v_referral.referrer_customer_id = p_referred_customer_id then
    raise exception 'You cannot use your own referral code.';
  end if;
  if v_referral.referred_customer_id is not null then
    raise exception 'This referral code has already been used.';
  end if;

  update public.referrals
  set referred_customer_id = p_referred_customer_id
  where id = v_referral.id;
end;
$$;
