-- Module 4: minimal newsletter email capture.
--
-- Nothing in the Module 1 schema stores newsletter signups — Module 19
-- ("Marketing & Customer Retention") owns the full campaign/segment/list
-- architecture later, but this module's homepage newsletter section needs
-- somewhere real to write to. Scoped to capture-only.
create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  source text,
  subscribed_at timestamptz not null default now()
);

alter table public.newsletter_subscribers enable row level security;

-- Mirrors analytics_events (Module 1): anyone can insert, only admins can
-- read the collected list back.
create policy "Newsletter signups are insertable by anyone"
  on public.newsletter_subscribers for insert with check (true);

create policy "Newsletter subscribers are readable by admin"
  on public.newsletter_subscribers for select using (public.is_admin());

create policy "Newsletter subscribers are managed by admin"
  on public.newsletter_subscribers for update using (public.is_admin());

create policy "Newsletter subscribers are deleted by admin"
  on public.newsletter_subscribers for delete using (public.is_admin());
