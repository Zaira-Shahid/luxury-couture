-- Module 1: in-app notifications and customer reviews.

-- Notifications are created by the system/admin (service-role client),
-- not by customers — a customer may only read and mark their own as
-- read, which is a deliberate narrowing of the general owner-scoped
-- pattern used elsewhere in this migration set.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  channel text not null default 'in_app' check (channel in ('email', 'whatsapp', 'in_app', 'sms')),
  read_at timestamptz,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index notifications_profile_id_idx on public.notifications (profile_id);

alter table public.notifications enable row level security;

create policy "Notifications are viewable by their owner or admin"
  on public.notifications for select
  using (profile_id = auth.uid() or public.is_admin());

create policy "Notifications are markable as read by their owner"
  on public.notifications for update
  using (profile_id = auth.uid() or public.is_admin());

create policy "Notifications are created by admin"
  on public.notifications for insert with check (public.is_admin());

--------------------------------------------------------------------------------

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  order_id uuid references public.orders (id) on delete set null,
  product_id uuid references public.products (id) on delete set null,
  rating integer not null check (rating between 1 and 5),
  title text,
  body text,
  is_published boolean not null default false,
  is_featured boolean not null default false,
  admin_response text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index reviews_product_id_idx on public.reviews (product_id);
create index reviews_customer_id_idx on public.reviews (customer_id);

create trigger set_reviews_updated_at
  before update on public.reviews
  for each row execute function public.set_updated_at();

alter table public.reviews enable row level security;

create policy "Published reviews are public, own reviews visible to owner"
  on public.reviews for select
  using (is_published or customer_id = auth.uid() or public.is_admin());

create policy "Reviews are insertable by their author"
  on public.reviews for insert
  with check (customer_id = auth.uid());

create policy "Reviews are updatable by their author or admin"
  on public.reviews for update
  using (customer_id = auth.uid() or public.is_admin());

--------------------------------------------------------------------------------

create table public.review_media (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews (id) on delete cascade,
  url text not null,
  type text not null default 'image' check (type in ('image', 'video')),
  created_at timestamptz not null default now()
);

create index review_media_review_id_idx on public.review_media (review_id);

alter table public.review_media enable row level security;

create policy "Review media follows its review's visibility"
  on public.review_media for select
  using (
    exists (
      select 1 from public.reviews r
      where r.id = review_id
        and (r.is_published or r.customer_id = auth.uid() or public.is_admin())
    )
  );

create policy "Review media is insertable by the review's author"
  on public.review_media for insert
  with check (
    exists (select 1 from public.reviews r where r.id = review_id and r.customer_id = auth.uid())
    or public.is_admin()
  );

create policy "Review media is deletable by the review's author or admin"
  on public.review_media for delete
  using (
    exists (select 1 from public.reviews r where r.id = review_id and r.customer_id = auth.uid())
    or public.is_admin()
  );
