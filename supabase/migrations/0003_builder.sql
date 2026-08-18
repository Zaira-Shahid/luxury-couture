-- Module 1: custom lehenga builder — option taxonomy + configurations.
-- The six option tables below share one shape: a named, orderable,
-- toggle-able option with an optional builder price adjustment.

create table public.fabrics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  image_url text,
  price_adjustment numeric(10, 2) not null default 0,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.embroidery_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  image_url text,
  price_adjustment numeric(10, 2) not null default 0,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.colours (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  hex_value text,
  image_url text,
  price_adjustment numeric(10, 2) not null default 0,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sleeve_styles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  image_url text,
  price_adjustment numeric(10, 2) not null default 0,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.necklines (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  image_url text,
  price_adjustment numeric(10, 2) not null default 0,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.dupatta_options (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  image_url text,
  price_adjustment numeric(10, 2) not null default 0,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
declare
  t text;
begin
  foreach t in array array[
    'fabrics', 'embroidery_types', 'colours',
    'sleeve_styles', 'necklines', 'dupatta_options'
  ]
  loop
    execute format(
      'create trigger set_%1$s_updated_at before update on public.%1$s
       for each row execute function public.set_updated_at()', t
    );
    execute format('alter table public.%1$s enable row level security', t);
    execute format(
      'create policy "Active %1$s are publicly readable" on public.%1$s
       for select using (is_active or public.is_admin())', t
    );
    execute format(
      'create policy "%1$s are managed by admin" on public.%1$s
       for insert with check (public.is_admin())', t
    );
    execute format(
      'create policy "%1$s are updated by admin" on public.%1$s
       for update using (public.is_admin())', t
    );
    execute format(
      'create policy "%1$s are deleted by admin" on public.%1$s
       for delete using (public.is_admin())', t
    );
  end loop;
end $$;

--------------------------------------------------------------------------------

-- A customer's (or guest's) in-progress or submitted custom lehenga design.
-- estimated_price is system-calculated and never authoritative — see
-- quotations.quoted_price in 0006 for the admin-controlled final price.
create table public.builder_configurations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.profiles (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  fabric_id uuid references public.fabrics (id) on delete set null,
  embroidery_type_id uuid references public.embroidery_types (id) on delete set null,
  colour_id uuid references public.colours (id) on delete set null,
  sleeve_style_id uuid references public.sleeve_styles (id) on delete set null,
  neckline_id uuid references public.necklines (id) on delete set null,
  dupatta_option_id uuid references public.dupatta_options (id) on delete set null,
  custom_notes text,
  estimated_price numeric(10, 2),
  status text not null default 'draft' check (status in ('draft', 'submitted')),
  share_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index builder_configurations_customer_id_idx on public.builder_configurations (customer_id);
create unique index builder_configurations_share_token_idx on public.builder_configurations (share_token);

create trigger set_builder_configurations_updated_at
  before update on public.builder_configurations
  for each row execute function public.set_updated_at();

alter table public.builder_configurations enable row level security;

-- Guest (customer_id null) configurations are addressable only by their
-- share_token in practice — discoverable via row scan here, but Module 6
-- (the actual builder UX) will tighten guest ownership with a session
-- cookie/claim flow before shipping the public builder.
create policy "Builder configurations are viewable by owner, guest, or admin"
  on public.builder_configurations for select
  using (customer_id = auth.uid() or customer_id is null or public.is_admin());

create policy "Builder configurations are insertable by owner or guest"
  on public.builder_configurations for insert
  with check (customer_id = auth.uid() or customer_id is null);

create policy "Builder configurations are updatable by owner or admin"
  on public.builder_configurations for update
  using (customer_id = auth.uid() or public.is_admin());

--------------------------------------------------------------------------------

create table public.inspiration_images (
  id uuid primary key default gen_random_uuid(),
  builder_configuration_id uuid not null
    references public.builder_configurations (id) on delete cascade,
  uploaded_by uuid references public.profiles (id) on delete set null,
  storage_path text not null,
  url text not null,
  created_at timestamptz not null default now()
);

create index inspiration_images_builder_configuration_id_idx
  on public.inspiration_images (builder_configuration_id);

alter table public.inspiration_images enable row level security;

create policy "Inspiration images follow their configuration's visibility"
  on public.inspiration_images for select
  using (
    exists (
      select 1 from public.builder_configurations bc
      where bc.id = builder_configuration_id
        and (bc.customer_id = auth.uid() or bc.customer_id is null or public.is_admin())
    )
  );

create policy "Inspiration images are insertable with their configuration"
  on public.inspiration_images for insert
  with check (
    exists (
      select 1 from public.builder_configurations bc
      where bc.id = builder_configuration_id
        and (bc.customer_id = auth.uid() or bc.customer_id is null)
    )
  );

create policy "Inspiration images are deletable by owner or admin"
  on public.inspiration_images for delete
  using (
    public.is_admin()
    or exists (
      select 1 from public.builder_configurations bc
      where bc.id = builder_configuration_id and bc.customer_id = auth.uid()
    )
  );
