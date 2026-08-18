-- Module 1: profiles (extends auth.users) and customer addresses.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'customer'
    check (role in ('customer', 'admin', 'staff', 'production')),
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

create policy "Profiles are viewable by owner or admin"
  on public.profiles for select
  using (id = auth.uid() or public.is_admin());

create policy "Profiles are updatable by owner or admin"
  on public.profiles for update
  using (id = auth.uid() or public.is_admin());

-- Customers may update their own profile, but never self-promote roles.
-- Inserts happen only via the handle_new_user trigger (SECURITY DEFINER),
-- so no client-facing insert policy is granted.
revoke update (role) on public.profiles from authenticated;

--------------------------------------------------------------------------------

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  label text,
  recipient_name text not null,
  line1 text not null,
  line2 text,
  city text not null,
  region text,
  postal_code text not null,
  country text not null,
  phone text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index addresses_customer_id_idx on public.addresses (customer_id);

create trigger set_addresses_updated_at
  before update on public.addresses
  for each row execute function public.set_updated_at();

alter table public.addresses enable row level security;

create policy "Addresses are managed by their owner or admin"
  on public.addresses for all
  using (customer_id = auth.uid() or public.is_admin())
  with check (customer_id = auth.uid() or public.is_admin());
