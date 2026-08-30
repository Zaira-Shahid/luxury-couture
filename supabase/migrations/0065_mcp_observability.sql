-- Module 43 — MCP observability: what the tools did, and what they refused.
--
-- WHAT WAS ACTUALLY THERE BEFORE THIS FILE, checked rather than assumed:
-- one `logger.info` line per tool call, written to the process console.
-- On this deployment that is Vercel's log stream — ephemeral, not
-- queryable from the application, and gone by the time anyone asks "why
-- did the assistant say it could not do that". Nothing about a tool call
-- was persisted unless the tool was a WRITE, because `recordToolCall()`
-- returned early for every other kind. So an authorization refusal on
-- any of the nineteen READ tools was recorded nowhere at all.
--
-- TWO TABLES, NOT ONE, and the split is the whole design.
--
-- 12B.7 refused to audit reads to the database, and was right: a row per
-- successful read would be a second copy of the catalogue that nobody
-- would ever query. That argument holds for successes and collapses for
-- refusals — a FORBIDDEN is not bulk data, it is the one event an
-- operator actually goes looking for.
--
-- So successes are counted and refusals are kept:
--
--   mcp_tool_stats    one row per (tool, hour), incremented in place.
--                     A thousand calls in an hour is one row, so this
--                     cannot grow with traffic — only with time and with
--                     the number of tools.
--   mcp_tool_failures one row per refused or failed call, with the
--                     REDACTED arguments, because "what did it try to
--                     do" is the question asked afterwards.
--
-- Neither table gets an INSERT, UPDATE or DELETE policy, following
-- 0063: both are written only by the dispatcher through the service-role
-- client, and a record of refusals that the refused party could delete
-- would not be a record of anything.

--------------------------------------------------------------------------------

create table public.mcp_tool_stats (
  tool_name text not null,
  -- Truncated to the hour by the increment function below, never by the
  -- caller: a caller that passed its own bucket could write a row that
  -- no query would ever find.
  hour timestamptz not null,
  calls integer not null default 0,
  failures integer not null default 0,
  -- High-risk actions that stopped and asked. Counted separately because
  -- "proposed but never approved" is a real signal about an assistant
  -- and reads as neither a success nor a failure.
  confirmations integer not null default 0,
  duration_ms_total bigint not null default 0,
  -- The uniqueness IS the aggregation: the upsert below has nowhere to
  -- write a duplicate bucket.
  primary key (tool_name, hour)
);

create index mcp_tool_stats_hour_idx on public.mcp_tool_stats (hour desc);

alter table public.mcp_tool_stats enable row level security;

-- Read gated on settings.manage rather than on "any admin". Call volumes
-- and failure rates across every staff account are operational data
-- about colleagues, and the same key already gates system_diagnostics,
-- which is the tool that answers the same kind of question.
create policy "MCP tool stats are readable with settings.manage"
  on public.mcp_tool_stats for select
  using (public.has_permission('settings.manage'));

--------------------------------------------------------------------------------

create table public.mcp_tool_failures (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  -- Correlates with the application log line for the same call.
  request_id uuid,
  tool_name text not null,
  -- `on delete set null`, not cascade: a refusal is still worth having
  -- after the account that caused it is removed.
  actor_id uuid references public.profiles (id) on delete set null,
  actor_role text,
  -- The McpError code catalogue: FORBIDDEN, VALIDATION_ERROR, NOT_FOUND,
  -- CONFLICT, RATE_LIMITED, INTERNAL_ERROR. Stored as text rather than
  -- an enum so a new code in errors.ts does not need a migration to be
  -- recordable — a failure recorded under an unknown code is still a
  -- failure, and dropping it would be the worse outcome.
  error_code text not null,
  -- Passed through redactInput() before it gets here: sensitive keys
  -- lose their values, long strings are truncated, deep objects are
  -- capped. This column is not a second copy of the arguments.
  input jsonb,
  duration_ms integer
);

-- The two ways this table is read: the recent feed, and one tool's
-- history. Both are time-ordered, so both indexes are descending.
create index mcp_tool_failures_occurred_idx
  on public.mcp_tool_failures (occurred_at desc);

create index mcp_tool_failures_tool_idx
  on public.mcp_tool_failures (tool_name, occurred_at desc);

-- Refusals are the security-interesting half, so the actor is the third
-- way in: "what has this account been refused this week".
create index mcp_tool_failures_actor_idx
  on public.mcp_tool_failures (actor_id, occurred_at desc)
  where actor_id is not null;

alter table public.mcp_tool_failures enable row level security;

create policy "MCP tool failures are readable with settings.manage"
  on public.mcp_tool_failures for select
  using (public.has_permission('settings.manage'));

--------------------------------------------------------------------------------

-- One atomic increment per call.
--
-- WHY AN RPC RATHER THAN A READ-THEN-WRITE IN THE APPLICATION: two calls
-- landing in the same hour would both read the same count and both write
-- it plus one, and the metric would quietly under-report exactly when
-- traffic is highest. `on conflict do update` makes Postgres resolve
-- that, in one statement, with no round trip in between.
--
-- SECURITY DEFINER because the table has no INSERT policy — that is
-- deliberate (see above) and this function is the only sanctioned way
-- in. Execute is then revoked from everyone and granted to service_role
-- alone, following 0059: a signed-in customer must not be able to
-- inflate a counter, and the lesson of 0058/0059 is that `revoke from
-- public` also strips what service_role inherits, so the grant is
-- explicit rather than assumed.
create or replace function public.record_mcp_tool_call(
  p_tool_name text,
  p_failed boolean,
  p_confirmation boolean,
  p_duration_ms integer
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.mcp_tool_stats (
    tool_name, hour, calls, failures, confirmations, duration_ms_total
  )
  values (
    p_tool_name,
    date_trunc('hour', now()),
    1,
    case when p_failed then 1 else 0 end,
    case when p_confirmation then 1 else 0 end,
    greatest(coalesce(p_duration_ms, 0), 0)
  )
  on conflict (tool_name, hour) do update set
    calls = mcp_tool_stats.calls + 1,
    failures = mcp_tool_stats.failures + case when p_failed then 1 else 0 end,
    confirmations =
      mcp_tool_stats.confirmations + case when p_confirmation then 1 else 0 end,
    duration_ms_total =
      mcp_tool_stats.duration_ms_total + greatest(coalesce(p_duration_ms, 0), 0);
$$;

revoke execute on function public.record_mcp_tool_call(text, boolean, boolean, integer)
  from public, anon, authenticated;
grant execute on function public.record_mcp_tool_call(text, boolean, boolean, integer)
  to service_role;

--------------------------------------------------------------------------------

-- The admin screen's two aggregate reads.
--
-- SECURITY INVOKER (the default), following 0046 and for its reason: both
-- only READ, so the select policies above govern them for free. A definer
-- function here would bypass RLS and would need its own permission guard
-- that a later edit could silently drop.

-- Totals per tool over a window, ordered by the thing an operator looks
-- for first: what is failing most.
create or replace function public.get_mcp_tool_stats(
  p_from timestamptz,
  p_to timestamptz
)
returns table(
  tool_name text,
  calls bigint,
  failures bigint,
  confirmations bigint,
  avg_duration_ms numeric
)
language sql
stable
set search_path = public
as $$
  select
    s.tool_name,
    sum(s.calls)::bigint as calls,
    sum(s.failures)::bigint as failures,
    sum(s.confirmations)::bigint as confirmations,
    -- nullif guards the impossible-but-cheap case of a bucket row with
    -- zero calls; a division by zero here would take down the whole page
    -- rather than one number on it.
    round(sum(s.duration_ms_total)::numeric / nullif(sum(s.calls), 0), 0) as avg_duration_ms
  from public.mcp_tool_stats s
  where s.hour >= p_from
    and s.hour < p_to
  group by s.tool_name
  order by failures desc, calls desc;
$$;

-- Failures grouped by code, so "twelve refusals" can be read as "eleven
-- permission refusals and one broken query" — which are different
-- problems with different owners.
create or replace function public.get_mcp_failure_summary(
  p_from timestamptz,
  p_to timestamptz
)
returns table(error_code text, failures bigint)
language sql
stable
set search_path = public
as $$
  select f.error_code, count(*)::bigint as failures
  from public.mcp_tool_failures f
  where f.occurred_at >= p_from
    and f.occurred_at < p_to
  group by f.error_code
  order by failures desc;
$$;
