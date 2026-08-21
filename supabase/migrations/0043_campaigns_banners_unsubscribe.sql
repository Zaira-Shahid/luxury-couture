-- Module 19 Pass 2: campaigns, newsletter unsubscribe, promotional
-- banners. Customer segments are computed at read time from data that
-- already exists (orders/profiles, same aggregate getAdminCustomers()
-- already builds) — no segment table, per the approved scope call.

alter table public.newsletter_subscribers
  add column unsubscribed_at timestamptz,
  add column unsubscribe_token uuid not null default gen_random_uuid();

-- A subscriber has no account and no RLS path to their own row at all
-- (0020: select/update/delete are admin-only) — same shape as every
-- other guest-facing, token-gated operation in this project (builder
-- share tokens, etc.). This is the only way an unsubscribe link can work
-- without requiring the visitor to sign in first.
create or replace function public.unsubscribe_newsletter(p_token uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.newsletter_subscribers
  set unsubscribed_at = now()
  where unsubscribe_token = p_token and unsubscribed_at is null;
end;
$$;

--------------------------------------------------------------------------------

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  body text not null,
  target text not null check (target in ('all_subscribers', 'vip_customers', 'new_customers', 'at_risk_customers')),
  status text not null default 'draft' check (status in ('draft', 'sent')),
  recipient_count integer,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_campaigns_updated_at
  before update on public.campaigns
  for each row execute function public.set_updated_at();

alter table public.campaigns enable row level security;

create policy "Campaigns are admin-only"
  on public.campaigns for all
  using (public.is_admin())
  with check (public.is_admin());

--------------------------------------------------------------------------------

-- Replaces Module 3's single site_settings announcement toggle (one
-- global on/off text string, no scheduling, no multiplicity) — this is
-- Module 19's own "promotional banners" bullet, a real capability
-- upgrade, not something layered alongside the old mechanism (which
-- would just stack two banners at once). SiteHeader/AnnouncementBar
-- switch to reading from here instead.
create table public.promotional_banners (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  link_url text,
  starts_at timestamptz,
  expires_at timestamptz,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index promotional_banners_sort_order_idx on public.promotional_banners (sort_order);

create trigger set_promotional_banners_updated_at
  before update on public.promotional_banners
  for each row execute function public.set_updated_at();

alter table public.promotional_banners enable row level security;

-- Same shape as the six builder-option tables / social_gallery_images:
-- public read when active, admin-only write. Schedule (starts_at/
-- expires_at) is enforced in the application query, same as coupons'
-- own starts_at/expires_at handling — RLS only gates is_active.
create policy "Active promotional banners are publicly readable"
  on public.promotional_banners for select
  using (is_active or public.is_admin());

create policy "Promotional banners are managed by admin"
  on public.promotional_banners for insert with check (public.is_admin());
create policy "Promotional banners are updated by admin"
  on public.promotional_banners for update using (public.is_admin());
create policy "Promotional banners are deleted by admin"
  on public.promotional_banners for delete using (public.is_admin());
