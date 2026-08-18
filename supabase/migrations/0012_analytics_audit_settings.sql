-- Module 1: local analytics events, admin audit log, and site settings.
-- theme_settings from the original domain list is folded into
-- site_settings below (namespaced keys, e.g. "theme.primary_color") —
-- both are just admin-configurable key/value config.

create table public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  profile_id uuid references public.profiles (id) on delete set null,
  session_id text,
  properties jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index analytics_events_event_name_idx on public.analytics_events (event_name);
create index analytics_events_occurred_at_idx on public.analytics_events (occurred_at);

alter table public.analytics_events enable row level security;

-- Any visitor (including anonymous) can log an event; only admins can
-- read the collected data back.
create policy "Analytics events are insertable by anyone"
  on public.analytics_events for insert with check (true);

create policy "Analytics events are readable by admin"
  on public.analytics_events for select using (public.is_admin());

--------------------------------------------------------------------------------

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);

alter table public.audit_logs enable row level security;

create policy "Audit logs are admin-only"
  on public.audit_logs for all
  using (public.is_admin())
  with check (public.is_admin());

--------------------------------------------------------------------------------

-- Admin-only for now. Module 3 (design system/branding) may add a
-- narrowly-scoped public-read policy for specific public-facing keys
-- (e.g. theme.*, general.brand_name) once it defines exactly which
-- settings the storefront needs to render.
create table public.site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

alter table public.site_settings enable row level security;

create policy "Site settings are admin-only"
  on public.site_settings for all
  using (public.is_admin())
  with check (public.is_admin());
