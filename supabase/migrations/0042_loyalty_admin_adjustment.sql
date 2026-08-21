-- Module 19 Pass 1 follow-up: an admin manual adjustment was about to
-- reuse earn_loyalty_points/redeem_loyalty_points, which would mislabel
-- the transaction as 'earn'/'redeem' in the customer's own history —
-- loyalty_transactions.type already has a distinct 'adjust' value for
-- exactly this case (0010's own check constraint). A dedicated RPC keeps
-- earn/redeem correctly typed for their real callers (payment success,
-- checkout redemption) and gives admin adjustments their own honest label.
create or replace function public.adjust_loyalty_points(p_customer_id uuid, p_points integer, p_reference text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_id uuid;
begin
  insert into public.loyalty_accounts (customer_id, points_balance)
  values (p_customer_id, 0)
  on conflict (customer_id) do nothing;

  select id into v_account_id from public.loyalty_accounts where customer_id = p_customer_id for update;

  insert into public.loyalty_transactions (loyalty_account_id, type, points, reference)
  values (v_account_id, 'adjust', p_points, p_reference);

  update public.loyalty_accounts set points_balance = points_balance + p_points where id = v_account_id;
end;
$$;
