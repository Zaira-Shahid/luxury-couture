-- Module 20 Pass 2: FAQs.
--
-- blog_posts, pages, media and seo_metadata all already exist from Module
-- 1 (0011) — this is the one content table that was never created, and
-- FAQPage structured data has no source without it.
--
-- Deliberately a real table rather than a CMS page with hand-written
-- markup: Modules 22/23 require a "deterministic FAQ engine" over a "safe
-- knowledge source", and question/answer rows are that source. Storing
-- FAQs as prose inside a `pages` row would make both the FAQPage schema
-- and the future chatbot depend on parsing HTML.

create table public.faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  -- Free-text grouping ("Ordering", "Sizing", ...). Nullable so the
  -- owner can ignore categorisation entirely and still publish FAQs.
  category text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index faqs_active_sort_idx on public.faqs (is_active, sort_order);

create trigger set_faqs_updated_at
  before update on public.faqs
  for each row execute function public.set_updated_at();

alter table public.faqs enable row level security;

-- Same "published is public, everything is admin" shape as blog_posts and
-- pages in 0011, so an inactive FAQ is invisible to anonymous readers at
-- the database level and not merely filtered in the query.
create policy "Active FAQs are publicly readable"
  on public.faqs for select
  using (is_active or public.is_admin());

create policy "FAQs are managed by admin"
  on public.faqs for insert with check (public.is_admin());
create policy "FAQs are updated by admin"
  on public.faqs for update using (public.is_admin());
create policy "FAQs are deleted by admin"
  on public.faqs for delete using (public.is_admin());
