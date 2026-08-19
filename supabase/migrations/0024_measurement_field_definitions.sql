-- Module 7: admin-configurable measurement field catalog.
--
-- measurements.field_key (0004, Module 1) was deliberately free-text, per
-- that migration's own comment, so this table could define the actual
-- field set later without fighting fixed columns. Same public-read/
-- admin-write shape as fabrics/colours/etc.
create table public.measurement_field_definitions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  category text not null,
  description text,
  guide_image_url text,
  guide_video_url text,
  is_required boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_measurement_field_definitions_updated_at
  before update on public.measurement_field_definitions
  for each row execute function public.set_updated_at();

alter table public.measurement_field_definitions enable row level security;

create policy "Active measurement fields are publicly readable"
  on public.measurement_field_definitions for select
  using (is_active or public.is_admin());

create policy "Measurement fields are managed by admin"
  on public.measurement_field_definitions for insert with check (public.is_admin());
create policy "Measurement fields are updated by admin"
  on public.measurement_field_definitions for update using (public.is_admin());
create policy "Measurement fields are deleted by admin"
  on public.measurement_field_definitions for delete using (public.is_admin());

--------------------------------------------------------------------------------

-- Separate from measurement_profiles.notes (customer-facing) so an admin's
-- "please remeasure your waist" doesn't collide with the customer's own
-- notes field — both are freely editable by their respective side.
alter table public.measurement_profiles
  add column admin_notes text;

--------------------------------------------------------------------------------

insert into public.measurement_field_definitions
  (key, label, category, description, is_required, sort_order)
values
  ('bust', 'Bust / Chest', 'Upper Body',
    'Measure around the fullest part of your bust, keeping the tape parallel to the floor.',
    true, 1),
  ('shoulder_width', 'Shoulder Width', 'Upper Body',
    'Measure across your back from the edge of one shoulder to the other.',
    true, 2),
  ('sleeve_length', 'Sleeve Length', 'Upper Body',
    'Measure from your shoulder point down to your desired sleeve end.',
    true, 3),
  ('blouse_length', 'Blouse Length', 'Upper Body',
    'Measure from the top of your shoulder down to your desired blouse length.',
    true, 4),
  ('armhole', 'Armhole', 'Upper Body',
    'Measure around your arm at the point where it meets your shoulder.',
    false, 5),
  ('bicep', 'Bicep', 'Upper Body',
    'Measure around the fullest part of your upper arm.',
    false, 6),
  ('front_neck_depth', 'Front Neck Depth', 'Upper Body',
    'Measure from the base of your neck down to your desired front neckline.',
    false, 7),
  ('back_neck_depth', 'Back Neck Depth', 'Upper Body',
    'Measure from the base of your neck down to your desired back neckline.',
    false, 8),
  ('waist', 'Waist', 'Waist & Hips',
    'Measure around your natural waistline, the narrowest part of your torso.',
    true, 9),
  ('hip', 'Hip', 'Waist & Hips',
    'Measure around the fullest part of your hips, about 8 inches below your waist.',
    true, 10),
  ('waist_to_hip', 'Waist to Hip', 'Waist & Hips',
    'Measure from your natural waistline down to the fullest part of your hips.',
    false, 11),
  ('lehenga_length', 'Lehenga Length', 'Lengths',
    'Measure from your natural waistline down to your ankle, or your desired hemline.',
    true, 12),
  ('waist_to_knee', 'Waist to Knee', 'Lengths',
    'Measure from your natural waistline down to your knee.',
    false, 13);
