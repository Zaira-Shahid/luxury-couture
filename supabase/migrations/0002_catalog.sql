-- Module 1: product catalog — categories, collections, products, images.

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories (id) on delete set null,
  name text not null,
  slug text not null unique,
  description text,
  image_url text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index categories_parent_id_idx on public.categories (parent_id);

create trigger set_categories_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

alter table public.categories enable row level security;

create policy "Active categories are publicly readable"
  on public.categories for select
  using (is_active or public.is_admin());

create policy "Categories are managed by admin"
  on public.categories for insert with check (public.is_admin());
create policy "Categories are updated by admin"
  on public.categories for update using (public.is_admin());
create policy "Categories are deleted by admin"
  on public.categories for delete using (public.is_admin());

--------------------------------------------------------------------------------

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  cover_image_url text,
  is_featured boolean not null default false,
  is_active boolean not null default true,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_collections_updated_at
  before update on public.collections
  for each row execute function public.set_updated_at();

alter table public.collections enable row level security;

create policy "Active collections are publicly readable"
  on public.collections for select
  using (is_active or public.is_admin());

create policy "Collections are managed by admin"
  on public.collections for insert with check (public.is_admin());
create policy "Collections are updated by admin"
  on public.collections for update using (public.is_admin());
create policy "Collections are deleted by admin"
  on public.collections for delete using (public.is_admin());

--------------------------------------------------------------------------------

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories (id) on delete set null,
  name text not null,
  slug text not null unique,
  sku text unique,
  description text,
  base_price numeric(10, 2) not null default 0 check (base_price >= 0),
  currency text not null default 'GBP',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  is_featured boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_category_id_idx on public.products (category_id);
create index products_status_idx on public.products (status);

create trigger set_products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

alter table public.products enable row level security;

create policy "Published products are publicly readable"
  on public.products for select
  using (status = 'published' or public.is_admin());

create policy "Products are managed by admin"
  on public.products for insert with check (public.is_admin());
create policy "Products are updated by admin"
  on public.products for update using (public.is_admin());
create policy "Products are deleted by admin"
  on public.products for delete using (public.is_admin());

--------------------------------------------------------------------------------

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  url text not null,
  alt_text text,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create index product_images_product_id_idx on public.product_images (product_id);

alter table public.product_images enable row level security;

create policy "Product images follow their product's visibility"
  on public.product_images for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.products p
      where p.id = product_id and p.status = 'published'
    )
  );

create policy "Product images are managed by admin"
  on public.product_images for insert with check (public.is_admin());
create policy "Product images are updated by admin"
  on public.product_images for update using (public.is_admin());
create policy "Product images are deleted by admin"
  on public.product_images for delete using (public.is_admin());

--------------------------------------------------------------------------------

create table public.product_collections (
  product_id uuid not null references public.products (id) on delete cascade,
  collection_id uuid not null references public.collections (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (product_id, collection_id)
);

alter table public.product_collections enable row level security;

create policy "Product-collection links are publicly readable"
  on public.product_collections for select using (true);

create policy "Product-collection links are managed by admin"
  on public.product_collections for insert with check (public.is_admin());
create policy "Product-collection links are deleted by admin"
  on public.product_collections for delete using (public.is_admin());
