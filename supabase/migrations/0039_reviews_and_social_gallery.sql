-- Module 18: a reviewer-name snapshot (customer-provided at submission,
-- not a live join to profiles) and the social gallery table backing the
-- Instagram-gallery abstraction.
--
-- profiles' own SELECT RLS is owner-or-admin only (0001) — a public
-- visitor reading a published review could never join a real name from
-- profiles without a new carve-out there. Capturing a display name once
-- at write time (same shape as enquiries.contact_name/
-- appointments.contact_name) avoids ever needing to touch profiles' RLS.
alter table public.reviews add column reviewer_name text;

-- No delete policy anywhere for reviews (0009) — every other admin-
-- deletable table in this schema has one, so its absence reads as
-- deliberate: moderate by hiding (is_published), never erase a review
-- outright. Nothing to add here; this comment documents that reading
-- for anyone auditing RLS later.

create table public.social_gallery_images (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  caption text,
  link_url text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index social_gallery_images_sort_order_idx on public.social_gallery_images (sort_order);

create trigger set_social_gallery_images_updated_at
  before update on public.social_gallery_images
  for each row execute function public.set_updated_at();

alter table public.social_gallery_images enable row level security;

-- Same shape as the six builder-option tables (0003): public read when
-- active, admin-only write.
create policy "Active social gallery images are publicly readable"
  on public.social_gallery_images for select
  using (is_active or public.is_admin());

create policy "Social gallery images are managed by admin"
  on public.social_gallery_images for insert with check (public.is_admin());
create policy "Social gallery images are updated by admin"
  on public.social_gallery_images for update using (public.is_admin());
create policy "Social gallery images are deleted by admin"
  on public.social_gallery_images for delete using (public.is_admin());

-- Photo testimonials need somewhere to actually store the file — neither
-- existing bucket (inspiration-images, media) is right: media is an
-- admin-only-RLS table for internal site imagery, and review photos are
-- customer-submitted content that must stay visible to the public once
-- the parent review is published. Same shape as the other two buckets:
-- public read, no client-write RLS — uploads go through a Server Action
-- after checking the caller owns the review, same pattern as every other
-- upload in this project.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('review-media', 'review-media', true, 5242880,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;
