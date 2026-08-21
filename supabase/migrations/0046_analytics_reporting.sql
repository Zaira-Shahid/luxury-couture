-- Module 21: reporting support for analytics_events.
--
-- The table itself (and its RLS: insert-by-anyone, select-by-admin) has
-- existed since Module 1 (0012) but was never written to or read from.
-- This adds the indexes and aggregate functions the admin funnel needs.
--
-- IMPORTANT: every function here is SECURITY INVOKER (the default) —
-- deliberately unlike find_and_mark_abandoned_carts (0044), which needs
-- definer rights to mutate carts a visitor can't touch. These only READ
-- analytics_events, so running them as the caller means the existing
-- "Analytics events are readable by admin" policy governs them for free.
-- A definer function here would bypass RLS and would need its own
-- is_admin() guard that a future edit could silently drop.

-- occurred_at and event_name are already indexed individually (0012).
-- Funnel queries filter by BOTH and group by session, so add the
-- composite plus the two id columns joins/aggregates use.
create index analytics_events_name_occurred_idx
  on public.analytics_events (event_name, occurred_at desc);

create index analytics_events_session_idx
  on public.analytics_events (session_id)
  where session_id is not null;

create index analytics_events_profile_idx
  on public.analytics_events (profile_id)
  where profile_id is not null;

--------------------------------------------------------------------------------

-- Totals per event name, plus the DISTINCT-session count used for the
-- funnel. Counting sessions (not rows) is what makes the funnel honest:
-- one visitor viewing ten products is one "product view" step, not ten.
create or replace function public.get_analytics_summary(
  p_from timestamptz,
  p_to timestamptz
)
returns table(event_name text, total_events bigint, unique_sessions bigint)
language sql
stable
set search_path = public
as $$
  select
    e.event_name,
    count(*) as total_events,
    count(distinct e.session_id) as unique_sessions
  from public.analytics_events e
  where e.occurred_at >= p_from
    and e.occurred_at < p_to
  group by e.event_name
  order by total_events desc;
$$;

--------------------------------------------------------------------------------

-- Daily counts per event, gap-filled so a day with no events is a real
-- zero rather than a missing point the chart would silently skip over.
create or replace function public.get_analytics_timeseries(
  p_from timestamptz,
  p_to timestamptz
)
returns table(day date, event_name text, total bigint)
language sql
stable
set search_path = public
as $$
  select
    d.day::date,
    n.event_name,
    coalesce(count(e.id), 0) as total
  from generate_series(p_from::date, (p_to::date - interval '1 day'), interval '1 day') as d(day)
  cross join (select distinct event_name from public.analytics_events) as n
  left join public.analytics_events e
    on e.event_name = n.event_name
   and e.occurred_at >= d.day
   and e.occurred_at < d.day + interval '1 day'
  group by d.day, n.event_name
  order by d.day;
$$;

--------------------------------------------------------------------------------

-- Most-viewed products over the window. productId lives in the event's
-- jsonb properties, so this joins back to products to resolve a name —
-- and drops rows whose product has since been deleted, rather than
-- reporting a dangling id.
create or replace function public.get_top_viewed_products(
  p_from timestamptz,
  p_to timestamptz,
  p_limit integer default 10
)
returns table(product_id uuid, product_name text, product_slug text, views bigint)
language sql
stable
set search_path = public
as $$
  select
    p.id,
    p.name,
    p.slug,
    count(*) as views
  from public.analytics_events e
  join public.products p
    on p.id = (e.properties ->> 'productId')::uuid
  where e.event_name = 'product_view'
    and e.occurred_at >= p_from
    and e.occurred_at < p_to
    and e.properties ->> 'productId' is not null
  group by p.id, p.name, p.slug
  order by views desc
  limit p_limit;
$$;
