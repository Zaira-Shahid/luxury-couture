-- Module 24: email delivery record and a real marketing opt-out.
--
-- Two compliance defects found while planning this module, both in
-- Module 19's campaign sending:
--
--  1. Marketing emails carried no unsubscribe link at all, even though
--     newsletter_subscribers.unsubscribe_token and the /unsubscribe page
--     already existed (0043).
--  2. Customer-segment campaigns (VIP / new / at-risk) skipped the
--     opt-out check entirely. `all_subscribers` filtered
--     unsubscribed_at, but customer recipients came from profiles, which
--     had no opt-out column to check — so an unsubscribed customer would
--     still be emailed.
--
-- UK PECR requires a working opt-out on every marketing email, so this
-- gives customers the same mechanism newsletter subscribers already had.

alter table public.profiles
  add column marketing_opt_out boolean not null default false,
  -- Per-customer token so an unsubscribe link works from an email
  -- WITHOUT signing in — the same reasoning as 0043's newsletter token.
  add column marketing_unsubscribe_token uuid not null default gen_random_uuid();

create index profiles_marketing_unsubscribe_token_idx
  on public.profiles (marketing_unsubscribe_token);

-- A customer following an unsubscribe link is not signed in, and
-- profiles' RLS only lets someone update their own row. Mirrors
-- unsubscribe_newsletter (0043) exactly: security definer, token-gated,
-- and deliberately silent about whether the token matched — confirming a
-- token's validity to an anonymous caller would leak account existence.
create or replace function public.unsubscribe_marketing(p_token uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set marketing_opt_out = true
  where marketing_unsubscribe_token = p_token;
end;
$$;

--------------------------------------------------------------------------------

-- A delivery record, so a send is not just a log line that disappears.
-- Same reasoning as ai_generations (0047): if something is sent on the
-- business's behalf there should be a record of what and to whom —
-- useful when a customer says they never received something, and it
-- makes a broken provider visible instead of silent.
create table public.email_deliveries (
  id uuid primary key default gen_random_uuid(),
  to_email text not null,
  -- Which template produced this, e.g. 'order_confirmed', 'campaign'.
  template_key text not null,
  subject text not null,
  -- 'mock' or 'resend' — so it is obvious whether a send was real.
  provider text not null,
  status text not null check (status in ('sent', 'failed')),
  error text,
  -- Set for a marketing send, null for transactional. Makes "prove every
  -- marketing email carried an opt-out" a query rather than an audit.
  is_marketing boolean not null default false,
  created_at timestamptz not null default now()
);

create index email_deliveries_created_idx on public.email_deliveries (created_at desc);
create index email_deliveries_status_idx on public.email_deliveries (status) where status = 'failed';

alter table public.email_deliveries enable row level security;

-- Admin-read-only. Writes go through the service-role client in the send
-- path, so no insert policy is granted: a visitor can neither read the
-- send history nor forge an entry in it.
create policy "Email deliveries are admin-readable"
  on public.email_deliveries for select using (public.is_admin());
