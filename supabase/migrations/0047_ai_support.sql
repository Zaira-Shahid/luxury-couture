-- Module 22: AI foundation support.
--
-- No table stores AI *capability* — the providers are stateless code.
-- What needs persisting is an audit trail of what was generated, because
-- the Master Build Plan requires AI to never bypass admin controls, and
-- that is only checkable if there is a record of what it produced and who
-- accepted it.

-- The recommendation engine's co-view tier looks up sessions by
-- (event_name, properties->>'productId'), then fans out over those
-- sessions. 0046 indexed (event_name, occurred_at) and (session_id);
-- this expression index is what makes the productId lookup itself cheap.
create index analytics_events_product_id_idx
  on public.analytics_events ((properties->>'productId'))
  where event_name = 'product_view';

--------------------------------------------------------------------------------

create table public.ai_generations (
  id uuid primary key default gen_random_uuid(),
  -- Which capability produced this: 'product_description' | 'email_draft'.
  -- Text rather than an enum so Modules 23/24 can add kinds without a
  -- migration, matching how notifications.type is handled.
  kind text not null,
  -- 'deterministic' or 'claude' — so an admin reviewing output can tell
  -- whether a model or a template wrote it.
  provider text not null,
  -- A short description of the request (product name, order number). NOT
  -- the full prompt: prompts are assembled from admin-curated FAQs and
  -- public catalogue data, so storing them again adds bulk, not insight.
  prompt_summary text,
  output text not null,
  -- Guardrail rules that fired, if any. A non-empty array means the model
  -- tried to state a price, date or status and was redacted — worth being
  -- able to query for.
  guardrail_violations jsonb not null default '[]'::jsonb,
  actor_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index ai_generations_kind_created_idx on public.ai_generations (kind, created_at desc);

alter table public.ai_generations enable row level security;

-- Admin-only in every direction. Unlike analytics_events (insert-by-anyone,
-- so anonymous visitors can be measured), nothing here is written by a
-- visitor — generation is an admin action behind the admin layout, so the
-- insert policy is admin too.
create policy "AI generations are admin-only"
  on public.ai_generations for all
  using (public.is_admin())
  with check (public.is_admin());
