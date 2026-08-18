-- Module 1: measurement profiles. Individual fields are stored as
-- key/value rows (not fixed columns) because Module 7 requires
-- admin-configurable measurement fields — fixed columns would fight that.

create table public.measurement_profiles (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  label text not null default 'My measurements',
  unit text not null default 'cm' check (unit in ('cm', 'inch')),
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'approved', 'correction_requested')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index measurement_profiles_customer_id_idx on public.measurement_profiles (customer_id);

create trigger set_measurement_profiles_updated_at
  before update on public.measurement_profiles
  for each row execute function public.set_updated_at();

alter table public.measurement_profiles enable row level security;

create policy "Measurement profiles are managed by their owner or admin"
  on public.measurement_profiles for all
  using (customer_id = auth.uid() or public.is_admin())
  with check (customer_id = auth.uid() or public.is_admin());

--------------------------------------------------------------------------------

create table public.measurements (
  id uuid primary key default gen_random_uuid(),
  measurement_profile_id uuid not null
    references public.measurement_profiles (id) on delete cascade,
  field_key text not null,
  value numeric(6, 2) not null check (value > 0),
  created_at timestamptz not null default now(),
  unique (measurement_profile_id, field_key)
);

create index measurements_profile_id_idx on public.measurements (measurement_profile_id);

alter table public.measurements enable row level security;

create policy "Measurements are managed by their profile's owner or admin"
  on public.measurements for all
  using (
    public.is_admin()
    or exists (
      select 1 from public.measurement_profiles mp
      where mp.id = measurement_profile_id and mp.customer_id = auth.uid()
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.measurement_profiles mp
      where mp.id = measurement_profile_id and mp.customer_id = auth.uid()
    )
  );
