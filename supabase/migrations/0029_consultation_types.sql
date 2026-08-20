-- Module 9: admin-configurable consultation type catalog, same
-- public-read/admin-write shape as fabrics/embroidery_types/etc.
-- appointments.type stays as the broad category (consultation/fitting/
-- other); consultation_type_id is the specific, admin-managed offering
-- shown to customers when booking.
create table public.consultation_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  duration_minutes integer not null default 30 check (duration_minutes > 0),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_consultation_types_updated_at
  before update on public.consultation_types
  for each row execute function public.set_updated_at();

alter table public.consultation_types enable row level security;

create policy "Active consultation types are publicly readable"
  on public.consultation_types for select
  using (is_active or public.is_admin());

create policy "Consultation types are managed by admin"
  on public.consultation_types for insert with check (public.is_admin());
create policy "Consultation types are updated by admin"
  on public.consultation_types for update using (public.is_admin());
create policy "Consultation types are deleted by admin"
  on public.consultation_types for delete using (public.is_admin());

alter table public.appointments
  add column consultation_type_id uuid references public.consultation_types (id) on delete set null;

insert into public.consultation_types (name, slug, description, duration_minutes, sort_order)
values
  ('In-Person Styling Consultation', 'in-person-styling',
    'Meet our design team in the atelier to explore fabrics, silhouettes, and embroidery in person.',
    60, 1),
  ('Virtual Design Consultation', 'virtual-design',
    'A video call with our design team — ideal if you can''t visit in person.',
    30, 2),
  ('Fitting Appointment', 'fitting',
    'An in-person fitting for a piece already in production.',
    45, 3),
  ('Design Review', 'design-review',
    'Review your custom builder design with a stylist before requesting a final quotation.',
    30, 4);
