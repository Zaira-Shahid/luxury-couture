-- Module 23: chatbot storage and abuse limiting.

-- Rate limiting. There is no rate limiting anywhere else in this project
-- (noted for Module 29 when /api/analytics shipped), but the chat
-- endpoint is a different risk class: with ANTHROPIC_API_KEY set, every
-- anonymous request spends real money. This is checked BEFORE any
-- provider call, so an abusive burst costs nothing.
--
-- A table rather than in-memory state because serverless instances do
-- not share memory — an in-process counter would reset on every cold
-- start and enforce nothing in production.
create table public.chat_rate_limits (
  -- sha256 of the session id or the client IP. Hashed, not raw: an IP is
  -- personal data under UK GDPR, and this table only needs to recognise
  -- a repeat caller, never to identify one.
  key_hash text primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0,
  updated_at timestamptz not null default now()
);

create index chat_rate_limits_window_idx on public.chat_rate_limits (window_started_at);

alter table public.chat_rate_limits enable row level security;
-- No policies at all: this is written by the route handler using the
-- service-role client and read by nothing else. Deny-by-default is the
-- correct posture — a visitor has no business seeing or editing counters.

--------------------------------------------------------------------------------

create table public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  -- Opaque client-generated id. Not the analytics session (that one is
  -- consent-gated and must not be reused for a functional feature) and
  -- not the cart session.
  session_id text not null,
  profile_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index chat_conversations_session_idx on public.chat_conversations (session_id);

create trigger set_chat_conversations_updated_at
  before update on public.chat_conversations
  for each row execute function public.set_updated_at();

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  -- Which FAQ answered, when one did. Null on an assistant message means
  -- the question went unanswered — which is the useful signal below.
  source_faq_id uuid references public.faqs (id) on delete set null,
  -- Set on the USER message when we could not answer it. This is the
  -- FAQ backlog: the questions customers actually ask that the knowledge
  -- base does not cover yet, surfaced in Admin → Content so the owner
  -- knows what to write next — arguably the most valuable thing the
  -- chatbot produces.
  unanswered boolean not null default false,
  created_at timestamptz not null default now()
);

create index chat_messages_conversation_idx on public.chat_messages (conversation_id, created_at);
create index chat_messages_unanswered_idx on public.chat_messages (created_at desc)
  where unanswered;

alter table public.chat_conversations enable row level security;
alter table public.chat_messages enable row level security;

-- Admin-only READ. Writes go through the route handler's service-role
-- client, so no insert policy is granted to anyone: a visitor cannot
-- forge a transcript, and cannot read anyone else's — including their
-- own, since the transcript lives in their browser during the session
-- and there is no feature that needs to read it back.
create policy "Chat conversations are admin-readable"
  on public.chat_conversations for select using (public.is_admin());
create policy "Chat messages are admin-readable"
  on public.chat_messages for select using (public.is_admin());
