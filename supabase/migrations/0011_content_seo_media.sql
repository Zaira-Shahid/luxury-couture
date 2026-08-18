-- Module 1: blog, static pages, media library, and polymorphic SEO metadata.

create table public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text,
  content text,
  cover_image_url text,
  author_id uuid references public.profiles (id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_blog_posts_updated_at
  before update on public.blog_posts
  for each row execute function public.set_updated_at();

alter table public.blog_posts enable row level security;

create policy "Published blog posts are publicly readable"
  on public.blog_posts for select
  using (status = 'published' or public.is_admin());

create policy "Blog posts are managed by admin"
  on public.blog_posts for insert with check (public.is_admin());
create policy "Blog posts are updated by admin"
  on public.blog_posts for update using (public.is_admin());
create policy "Blog posts are deleted by admin"
  on public.blog_posts for delete using (public.is_admin());

--------------------------------------------------------------------------------

create table public.pages (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  content text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_pages_updated_at
  before update on public.pages
  for each row execute function public.set_updated_at();

alter table public.pages enable row level security;

create policy "Published pages are publicly readable"
  on public.pages for select
  using (status = 'published' or public.is_admin());

create policy "Pages are managed by admin"
  on public.pages for insert with check (public.is_admin());
create policy "Pages are updated by admin"
  on public.pages for update using (public.is_admin());
create policy "Pages are deleted by admin"
  on public.pages for delete using (public.is_admin());

--------------------------------------------------------------------------------

create table public.media (
  id uuid primary key default gen_random_uuid(),
  uploader_id uuid references public.profiles (id) on delete set null,
  storage_path text not null,
  url text not null,
  file_type text,
  size_bytes bigint,
  alt_text text,
  created_at timestamptz not null default now()
);

alter table public.media enable row level security;

create policy "Media library is admin-only"
  on public.media for all
  using (public.is_admin())
  with check (public.is_admin());

--------------------------------------------------------------------------------

create table public.seo_metadata (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  meta_title text,
  meta_description text,
  og_image_url text,
  canonical_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entity_type, entity_id)
);

create trigger set_seo_metadata_updated_at
  before update on public.seo_metadata
  for each row execute function public.set_updated_at();

alter table public.seo_metadata enable row level security;

create policy "SEO metadata is publicly readable"
  on public.seo_metadata for select using (true);

create policy "SEO metadata is managed by admin"
  on public.seo_metadata for insert with check (public.is_admin());
create policy "SEO metadata is updated by admin"
  on public.seo_metadata for update using (public.is_admin());
create policy "SEO metadata is deleted by admin"
  on public.seo_metadata for delete using (public.is_admin());
