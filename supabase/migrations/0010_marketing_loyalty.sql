-- Module 1: coupons, referrals, and loyalty. Full program logic lands in
-- Module 19 — this is the storage foundation only.

-- Coupon codes/values are not exposed to the public table — validating a
-- code happens through a server-side function in Module 10 (checkout),
-- not a raw client SELECT, so codes can't be scraped wholesale.
create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  type text not null default 'percentage' check (type in ('percentage', 'fixed')),
  value numeric(10, 2) not null check (value >= 0),
  min_order_amount numeric(10, 2),
  max_uses integer,
  used_count integer not null default 0,
  starts_at timestamptz,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_coupons_updated_at
  before update on public.coupons
  for each row execute function public.set_updated_at();

alter table public.coupons enable row level security;

create policy "Coupons are admin-only"
  on public.coupons for all
  using (public.is_admin())
  with check (public.is_admin());

--------------------------------------------------------------------------------

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_customer_id uuid not null references public.profiles (id) on delete cascade,
  referred_customer_id uuid references public.profiles (id) on delete set null,
  code text not null unique,
  status text not null default 'pending' check (status in ('pending', 'completed')),
  reward_amount numeric(10, 2),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index referrals_referrer_customer_id_idx on public.referrals (referrer_customer_id);

alter table public.referrals enable row level security;

create policy "Referrals are viewable by their referrer or admin"
  on public.referrals for select
  using (referrer_customer_id = auth.uid() or public.is_admin());

create policy "Referrals are insertable by their referrer"
  on public.referrals for insert
  with check (referrer_customer_id = auth.uid());

create policy "Referrals are updated by admin"
  on public.referrals for update using (public.is_admin());

--------------------------------------------------------------------------------

create table public.loyalty_accounts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null unique references public.profiles (id) on delete cascade,
  points_balance integer not null default 0 check (points_balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_loyalty_accounts_updated_at
  before update on public.loyalty_accounts
  for each row execute function public.set_updated_at();

alter table public.loyalty_accounts enable row level security;

create policy "Loyalty accounts are viewable by their owner or admin"
  on public.loyalty_accounts for select
  using (customer_id = auth.uid() or public.is_admin());

create policy "Loyalty accounts are managed by admin"
  on public.loyalty_accounts for insert with check (public.is_admin());
create policy "Loyalty accounts are updated by admin"
  on public.loyalty_accounts for update using (public.is_admin());

--------------------------------------------------------------------------------

create table public.loyalty_transactions (
  id uuid primary key default gen_random_uuid(),
  loyalty_account_id uuid not null references public.loyalty_accounts (id) on delete cascade,
  type text not null check (type in ('earn', 'redeem', 'adjust')),
  points integer not null,
  reference text,
  created_at timestamptz not null default now()
);

create index loyalty_transactions_account_id_idx on public.loyalty_transactions (loyalty_account_id);

alter table public.loyalty_transactions enable row level security;

create policy "Loyalty transactions are viewable with their account"
  on public.loyalty_transactions for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.loyalty_accounts la
      where la.id = loyalty_account_id and la.customer_id = auth.uid()
    )
  );

create policy "Loyalty transactions are managed by admin"
  on public.loyalty_transactions for insert with check (public.is_admin());
