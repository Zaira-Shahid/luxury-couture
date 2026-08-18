-- Module 1: enquiries, quotations (admin-priced), and consultation appointments.

create table public.enquiries (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.profiles (id) on delete cascade,
  builder_configuration_id uuid references public.builder_configurations (id) on delete set null,
  type text not null default 'general' check (type in ('builder', 'consultation', 'general')),
  contact_name text not null,
  contact_email text not null,
  contact_phone text,
  message text,
  status text not null default 'new' check (status in ('new', 'in_review', 'quoted', 'closed')),
  assigned_admin_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index enquiries_customer_id_idx on public.enquiries (customer_id);
create index enquiries_status_idx on public.enquiries (status);

create trigger set_enquiries_updated_at
  before update on public.enquiries
  for each row execute function public.set_updated_at();

alter table public.enquiries enable row level security;

create policy "Enquiries are viewable by their owner or admin"
  on public.enquiries for select
  using (customer_id = auth.uid() or customer_id is null or public.is_admin());

create policy "Enquiries are insertable by their owner or a guest"
  on public.enquiries for insert
  with check (customer_id = auth.uid() or customer_id is null);

create policy "Enquiries are updatable by their owner or admin"
  on public.enquiries for update
  using (customer_id = auth.uid() or public.is_admin());

--------------------------------------------------------------------------------

-- quoted_price is the Final Admin Quote (section 4 of the Master Build
-- Plan) — authoritative, admin-set, distinct from any system estimate.
-- Only admins may write to this table; customers get read-only access
-- to their own quotations.
create table public.quotations (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null references public.enquiries (id) on delete cascade,
  customer_id uuid references public.profiles (id) on delete cascade,
  estimated_price numeric(10, 2),
  quoted_price numeric(10, 2) not null check (quoted_price >= 0),
  currency text not null default 'GBP',
  deposit_amount numeric(10, 2),
  deposit_percentage numeric(5, 2),
  valid_until timestamptz,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'accepted', 'rejected', 'expired')),
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index quotations_enquiry_id_idx on public.quotations (enquiry_id);
create index quotations_customer_id_idx on public.quotations (customer_id);

create trigger set_quotations_updated_at
  before update on public.quotations
  for each row execute function public.set_updated_at();

-- "Never recalculate an existing approved quote unexpectedly" (section 24).
create or replace function public.prevent_accepted_quotation_price_change()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'accepted' and new.quoted_price is distinct from old.quoted_price then
    raise exception 'quoted_price cannot change once a quotation has been accepted';
  end if;
  return new;
end;
$$;

create trigger guard_accepted_quotation_price
  before update on public.quotations
  for each row execute function public.prevent_accepted_quotation_price_change();

alter table public.quotations enable row level security;

create policy "Quotations are viewable by their customer or admin"
  on public.quotations for select
  using (customer_id = auth.uid() or public.is_admin());

create policy "Quotations are managed by admin"
  on public.quotations for insert with check (public.is_admin());
create policy "Quotations are updated by admin"
  on public.quotations for update using (public.is_admin());

--------------------------------------------------------------------------------

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.profiles (id) on delete cascade,
  type text not null default 'consultation' check (type in ('consultation', 'fitting', 'other')),
  scheduled_at timestamptz not null,
  duration_minutes integer not null default 30 check (duration_minutes > 0),
  status text not null default 'requested'
    check (status in ('requested', 'confirmed', 'completed', 'cancelled', 'no_show')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index appointments_customer_id_idx on public.appointments (customer_id);
create index appointments_scheduled_at_idx on public.appointments (scheduled_at);

create trigger set_appointments_updated_at
  before update on public.appointments
  for each row execute function public.set_updated_at();

alter table public.appointments enable row level security;

create policy "Appointments are viewable by their owner or admin"
  on public.appointments for select
  using (customer_id = auth.uid() or customer_id is null or public.is_admin());

create policy "Appointments are insertable by their owner or a guest"
  on public.appointments for insert
  with check (customer_id = auth.uid() or customer_id is null);

create policy "Appointments are updatable by their owner or admin"
  on public.appointments for update
  using (customer_id = auth.uid() or public.is_admin());
