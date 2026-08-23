-- Module 26 Pass 1: roles and permissions foundation.
--
-- This module was deferred to twice, in the same words both times:
--   * docs/ARCHITECTURE.md (Module 5): the (admin) layout admits
--     admin/staff/production, but RLS allows writes for role = 'admin'
--     only, so a staff account reaches /admin and then fails on submit.
--     "Fine-grained per-role admin permissions are explicitly Module 26."
--   * 0034_production_workflow.sql: closed a narrow slice of that gap for
--     production staff, "not the general per-role permission system
--     (that's Module 26). Additive policies only; every existing
--     is_admin()-gated policy is untouched."
--
-- That last line is the discipline this migration follows. There are 151
-- policies gated on is_admin() across 63 tables; PERMISSIVE policies are
-- OR'd, so ADDING a policy can only widen access and can never revoke an
-- existing admin's. Pass 1 therefore changes NO existing policy at all.
--
-- Two things here are not purely additive, and both are deliberate:
--   1. is_admin() is WIDENED to include super_admin. No super_admin row
--      exists at the moment this runs, so nothing changes for anyone.
--   2. prevent_role_self_promotion() is NARROWED from "any admin" to
--      "roles.manage". After this, a plain 'admin' can no longer change
--      anyone's role. Existing admins are promoted to super_admin below,
--      so the owner is unaffected — but it IS a narrowing, and it is
--      tested explicitly.

-- ---------------------------------------------------------------------
-- Roles

alter table public.profiles drop constraint profiles_role_check;

-- 'staff' is kept deliberately. Dropping it would make any existing row
-- carrying it instantly violate the constraint; it is treated as
-- deprecated and given the narrowest useful permission set below.
alter table public.profiles add constraint profiles_role_check
  check (role in (
    'customer',
    'super_admin',
    'admin',
    'sales',
    'production',
    'qc',
    'finance',
    'support',
    'marketing',
    'staff'
  ));

-- ---------------------------------------------------------------------
-- Permissions

create table public.permissions (
  key text primary key,
  domain text not null,
  description text not null
);

create table public.role_permissions (
  role text not null,
  permission_key text not null references public.permissions (key) on delete cascade,
  primary key (role, permission_key)
);

create index role_permissions_role_idx on public.role_permissions (role);

alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;

-- Readable by any signed-in staff member so the admin UI can render the
-- matrix; writable only by someone holding roles.manage. Note the write
-- policies are added AFTER has_permission() exists, further down.
create policy "Permissions are readable by staff"
  on public.permissions for select
  using (auth.uid() is not null);
create policy "Role permissions are readable by staff"
  on public.role_permissions for select
  using (auth.uid() is not null);

-- ---------------------------------------------------------------------
-- has_permission()
--
-- SECURITY DEFINER on purpose, and this is the important part: the
-- function reads profiles and role_permissions, and it is itself called
-- from inside policies on other tables. As an INVOKER function it would
-- be subject to the caller's RLS on those tables, which is exactly the
-- recursion 0036 already had to fix once for production-staff order
-- reads. Definer sidesteps that entirely.
--
-- It reads no `current_user`, so it does NOT hit the trap 0018
-- documented (inside a DEFINER function current_user resolves to the
-- function owner). prevent_role_self_promotion() still must stay
-- INVOKER for that reason — see below.
create or replace function public.has_permission(p_key text)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_role text;
begin
  select role into v_role from public.profiles where id = auth.uid();
  if v_role is null then
    return false;
  end if;

  -- super_admin holds everything implicitly rather than by seeded rows.
  -- If it were seeded, a permission added by a later module would not be
  -- granted to super_admin until someone remembered to seed it — and the
  -- one role that must never be locked out is this one.
  if v_role = 'super_admin' then
    return true;
  end if;

  return exists (
    select 1 from public.role_permissions
    where role = v_role and permission_key = p_key
  );
end;
$$;

-- ---------------------------------------------------------------------
-- is_admin(), widened

create or replace function public.is_admin()
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  -- Widened in Module 26 to include super_admin. Every one of the 151
  -- existing policies calls this, so its meaning is deliberately left as
  -- "full administrative access" rather than being rewritten to a
  -- permission check — rewriting it would reinterpret all 151 at once.
  return exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'super_admin')
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Write policies for the permission tables (has_permission now exists)

create policy "Permissions are managed by role managers"
  on public.permissions for all
  using (public.has_permission('roles.manage'))
  with check (public.has_permission('roles.manage'));

create policy "Role permissions are managed by role managers"
  on public.role_permissions for all
  using (public.has_permission('roles.manage'))
  with check (public.has_permission('roles.manage'));

-- ---------------------------------------------------------------------
-- Role assignment guard, narrowed
--
-- MUST stay SECURITY INVOKER. 0018 discovered that inside a SECURITY
-- DEFINER function current_user resolves to the function's owner
-- ('postgres'), which made 0017's service_role exemption match every
-- caller and silently disabled the guard entirely. Do not "tidy" this
-- into a definer function.
create or replace function public.prevent_role_self_promotion()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and not public.has_permission('roles.manage')
     and current_user not in ('service_role', 'postgres') then
    raise exception 'permission denied: cannot change role';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Seed: the permission catalogue

insert into public.permissions (key, domain, description) values
  ('roles.manage',      'system',     'Assign roles and edit the permission matrix'),
  ('settings.manage',   'system',     'Change business configuration'),
  ('orders.read',       'sales',      'View orders'),
  ('orders.write',      'sales',      'Create and update orders'),
  ('quotations.read',   'sales',      'View quotations'),
  ('quotations.write',  'sales',      'Create, send and revise quotations'),
  ('customers.read',    'sales',      'View customer accounts'),
  ('payments.read',     'finance',    'View payments'),
  ('payments.write',    'finance',    'Record and update payments'),
  ('payments.refund',   'finance',    'Issue refunds'),
  ('production.read',   'production', 'View production orders'),
  ('production.write',  'production', 'Advance production status'),
  ('qc.write',          'production', 'Record quality-check outcomes'),
  ('shipping.write',    'production', 'Create shipments and update tracking'),
  ('inventory.write',   'production', 'Adjust inventory'),
  ('enquiries.read',    'support',    'View enquiries and chat transcripts'),
  ('enquiries.write',   'support',    'Respond to enquiries and book consultations'),
  ('catalog.read',      'catalog',    'View products, collections and builder options'),
  ('catalog.write',     'catalog',    'Create and edit products, collections and builder options'),
  ('content.write',     'marketing',  'Edit pages, journal posts, FAQs and occasions'),
  ('marketing.write',   'marketing',  'Run campaigns, coupons and banners'),
  ('reviews.moderate',  'marketing',  'Publish, feature and respond to reviews'),
  ('analytics.read',    'marketing',  'View analytics and reports');

-- ---------------------------------------------------------------------
-- Seed: default role → permission mapping
--
-- super_admin is intentionally absent: has_permission() grants it
-- everything implicitly (see above). 'customer' is absent because a
-- customer holds no admin permissions at all.
insert into public.role_permissions (role, permission_key)
select v.role, v.permission_key
from (values
  -- admin: everything except role management
  ('admin', 'settings.manage'), ('admin', 'orders.read'), ('admin', 'orders.write'),
  ('admin', 'quotations.read'), ('admin', 'quotations.write'), ('admin', 'customers.read'),
  ('admin', 'payments.read'), ('admin', 'payments.write'), ('admin', 'payments.refund'),
  ('admin', 'production.read'), ('admin', 'production.write'), ('admin', 'qc.write'),
  ('admin', 'shipping.write'), ('admin', 'inventory.write'),
  ('admin', 'enquiries.read'), ('admin', 'enquiries.write'),
  ('admin', 'catalog.read'), ('admin', 'catalog.write'),
  ('admin', 'content.write'), ('admin', 'marketing.write'), ('admin', 'reviews.moderate'),
  ('admin', 'analytics.read'),

  -- sales: the order book and the people in it, not the money
  ('sales', 'orders.read'), ('sales', 'orders.write'),
  ('sales', 'quotations.read'), ('sales', 'quotations.write'),
  ('sales', 'customers.read'), ('sales', 'enquiries.read'), ('sales', 'enquiries.write'),
  ('sales', 'catalog.read'),

  -- production: the workshop
  ('production', 'production.read'), ('production', 'production.write'),
  ('production', 'shipping.write'), ('production', 'inventory.write'),
  ('production', 'orders.read'), ('production', 'catalog.read'),

  -- qc: sees production, records outcomes, changes nothing else
  ('qc', 'production.read'), ('qc', 'qc.write'), ('qc', 'orders.read'),

  -- finance: the money, and the orders it relates to
  ('finance', 'payments.read'), ('finance', 'payments.write'), ('finance', 'payments.refund'),
  ('finance', 'orders.read'), ('finance', 'analytics.read'),

  -- support: the customer conversation
  ('support', 'enquiries.read'), ('support', 'enquiries.write'),
  ('support', 'customers.read'), ('support', 'orders.read'),

  -- marketing: content and campaigns, no access to orders or money
  ('marketing', 'content.write'), ('marketing', 'marketing.write'),
  ('marketing', 'reviews.moderate'), ('marketing', 'analytics.read'),
  ('marketing', 'catalog.read'),

  -- staff (DEPRECATED): the narrowest useful set. Kept only so existing
  -- rows remain valid; assign a real role instead.
  ('staff', 'orders.read'), ('staff', 'enquiries.read')
) as v(role, permission_key)
on conflict do nothing;

-- ---------------------------------------------------------------------
-- Bootstrap
--
-- Without this nobody holds roles.manage, so nobody could ever assign it
-- — a permanent lockout on the very first migration. Existing admins
-- keep exactly the access they have today, plus role management.
update public.profiles set role = 'super_admin' where role = 'admin';
