-- Module 38 — the confirmation replay ledger.
--
-- Closes the limitation Module 36 recorded in Master Build Plan 12B.14:
-- confirmation tokens are stateless HMACs, so a token is single-ACTION
-- but not single-USE. Within its five-minute life the same confirmed
-- action could be executed twice — which was harmless while no high-risk
-- tool existed, and stops being harmless the moment products_archive
-- and products_publish arrive with this module.
--
-- A LEDGER rather than an expiry-only check, for the same reason
-- 0057 used one: the primary key makes a double-execution IMPOSSIBLE
-- rather than merely unlikely. The dispatcher inserts the token's
-- signature BEFORE running the action; if the insert conflicts, this
-- token has already been spent and the action does not run a second
-- time. Two concurrent calls carrying the same token cannot both win —
-- Postgres decides, not application timing.
--
-- The SIGNATURE is stored, never the whole token. The token is
-- `<expiry>.<hmac>`; the hmac half alone identifies it, and storing the
-- assembled token would put a still-valid credential in a table.

create table public.mcp_confirmations (
  -- The HMAC half of the token. Primary key: the uniqueness IS the
  -- protection, not an index added for speed.
  signature text primary key,
  -- Recorded for the audit trail — "who confirmed what, and when" is the
  -- question asked after a destructive action is queried.
  actor_id uuid references public.profiles (id) on delete set null,
  tool_name text not null,
  used_at timestamptz not null default now()
);

-- Spent tokens are only interesting until they expire (5 minutes) plus
-- however long anyone might investigate. This index makes the periodic
-- prune cheap; nothing in the request path scans by time.
create index mcp_confirmations_used_at_idx on public.mcp_confirmations (used_at);

alter table public.mcp_confirmations enable row level security;

-- No policy grants INSERT, UPDATE or DELETE to anyone, deliberately.
--
-- This table is written only by the MCP dispatcher through the
-- service-role client, which bypasses RLS. That is the point: a replay
-- ledger an administrator could delete from is a replay ledger an
-- administrator could defeat, and the whole purpose of the table is to
-- constrain what a confirmed admin action can do twice.
--
-- This makes the service-role client reachable from a THIRD place on the
-- MCP path, alongside the audit write and the rate limiter. Recorded in
-- 12B.2 rather than left to be discovered, and it takes no AI-supplied
-- input: the dispatcher writes a signature it computed itself.
--
-- Read access for admins only, so a spent confirmation is inspectable
-- when someone asks why an action refused to run twice.
create policy "Confirmation history is readable by admin"
  on public.mcp_confirmations for select
  using (public.is_admin());
