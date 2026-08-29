# MCP decision log

Architecture decisions for the MCP / AI application control layer, recorded
so a future session understands why the layer looks the way it does rather
than re-deriving it — or quietly reversing it.

Format: decision, reason, impact, date, module.

---

## MCP-001 — Domain-specific tools instead of arbitrary SQL

**Decision.** The AI reaches the application only through named tools in a
registry. No `execute_sql`, no `query(table)`, no tool that takes a table
name as an argument, no shell, no filesystem, no arbitrary HTTP.

**Reason.** Security and business-rule enforcement. A generic query tool
would make every RLS policy and every validation rule optional, because the
model could always route around them. It would also make "what can the AI
do here" unanswerable — you would have to audit a query builder instead of
reading a list.

**Impact.** Every AI database operation goes through an application service.
Adding a capability means adding a tool definition, in a module, with a
permission and tests. Permanent, recorded in Master Build Plan 12B.15.

*2026-08-28 · Module 36*

---

## MCP-002 — Authenticate with the application's own Supabase session

**Decision.** `/api/mcp` lives inside the Next.js app and identifies the
caller from the Supabase auth cookie or a Bearer access token. No MCP API
key, no service account, no second user store. Approved by the developer
before implementation.

**Alternatives rejected.** A local stdio server authenticating as a
dedicated Supabase service account has a smaller attack surface, but it
cannot power the in-dashboard admin chat that is the actual product goal,
and every audit row would name the same shared account rather than the
person who asked. Building both transports at once doubled the security
surface of the foundation module for no immediate gain.

**Impact.** The actor is a real human with a real role, so `has_permission()`,
`role_permissions` and every RLS policy apply to an AI-driven call exactly
as they apply to a click in the admin UI. A stdio adapter over the same
registry remains available in Module 43.

*2026-08-28 · Module 36*

---

## MCP-003 — Tool handlers use the caller's Supabase client, not service-role

**Decision.** `McpContext.supabase` is the client carrying the caller's
session. The service-role client is reachable from exactly two places on the
MCP path — the audit write and the rate limiter — neither of which takes
AI-supplied input.

**Reason.** Two independent boundaries. The registry decides what can be
asked for; RLS decides what the database will return. If a tool is ever
written carelessly, Postgres still refuses anything the signed-in human
could not have done themselves. A service-role client would collapse both
boundaries into one.

**Impact.** A tool that genuinely needs privileged access must document why
in Master Build Plan 12B.11 and confine it to that one operation. As of
Module 36 none does.

*2026-08-28 · Module 36*

---

## MCP-004 — Reuse the existing permission keys; invent no MCP-specific roles

**Decision.** Tools declare a `permission` from the 23 keys already in
`src/lib/auth/permissions.ts`. No new role, no new key, no `mcp.*` namespace.

**Reason.** MCP is a second doorway to capabilities the platform already
models. A new key would describe a capability the admin UI cannot express,
which is either a gap in the UI or a privilege escalation wearing a new
name. It would also give an administrator two different answers to "who can
change a price".

**Impact.** Module 26's matrix, editable in Admin -> Team, governs the AI
layer too, with no second matrix to keep in step.

*2026-08-28 · Module 36*

---

## MCP-005 — Hiding a tool is not the enforcement

**Decision.** `tools/list` is filtered by permission, but `tools/call`
re-checks the permission on every call regardless of what was listed.

**Reason.** A client can call a name it was never shown, exactly as a Server
Action is an addressable POST endpoint regardless of whether the button was
rendered. This is the same rule Module 26 states as "never rely only on
hiding UI buttons", applied to tools.

**Impact.** The filter is a usability measure that stops an assistant
proposing actions it cannot take. `scripts/test-mcp.mjs` asserts the
distinction directly: a production account is not shown
`system_diagnostics`, and is still refused when it calls it by name.

*2026-08-28 · Module 36*

---

## MCP-006 — Confirmation tokens are signed over tool + arguments + actor

**Decision.** A high-risk call returns an HMAC token with a 5-minute TTL
rather than accepting a `confirmed: true` flag.

**Reason.** A boolean is something the model can set by itself, which makes
the confirmation ceremonial. Binding the signature to the exact arguments
means confirming *that action* — a token issued for "archive these 24
products" cannot archive a different set, cannot be used on another tool,
and cannot be used by a colleague who saw it.

**Impact.** No table and no migration, at the cost recorded honestly in
Master Build Plan 12B.14: a token was single-action but not single-use
within its five minutes. Closed in Module 38 by the replay ledger — see
MCP-011. Signing uses `MCP_CONFIRMATION_SECRET`, falling back to
`SUPABASE_SERVICE_ROLE_KEY`; with neither, high-risk actions are refused
rather than run unconfirmed.

*2026-08-28 · Module 36*

---

## MCP-007 — Map database errors by code, never by message text

**Decision.** `toMcpError()` matches PostgREST/Postgres error codes.
Anything unrecognised becomes `INTERNAL_ERROR` with a fixed sentence.

**Reason.** The message is where table names, column names and row values
live, so returning it would leak schema detail to the model. Matching on
message substrings would additionally be one upstream wording change away
from silently breaking. Deny-by-default means a new failure mode cannot leak
by virtue of nobody having handled it yet.

**Impact.** `42501` reads as `FORBIDDEN` rather than as a server fault, so
an authorization refusal is never dressed up as a bug. Adding detail to a
caller-visible error requires adding an explicit mapping.

*2026-08-28 · Module 36*

---

## MCP-008 — Audit writes to the existing `audit_logs`, and reads not at all

**Decision.** Write tools call the existing `logAudit()` with
`action = mcp.<tool_name>`. Read tools write no database row and are
recorded only in the application log.

**Reason.** "Who changed this product" must have one answer regardless of
whether the change came through the admin UI or an AI instruction; a
separate MCP table would produce two half-answers and a join nobody
remembers to write. Auditing reads would create a second copy of the
catalogue that no one would query.

**Impact.** One query answers the question after an incident. Failures are
audited alongside successes, because "what did it try to do" is the question
actually asked afterwards.

*2026-08-28 · Module 36*

---

## MCP-009 — Hand-rolled protocol layer rather than the MCP SDK

**Decision.** `lib/mcp/protocol.ts` and `lib/mcp/server.ts` implement the
five JSON-RPC methods this server needs, instead of depending on
`@modelcontextprotocol/sdk`.

**Reason.** The SDK's transports are stdio and a stateful streamable-HTTP
session. This deployment is a stateless Vercel route handler carrying a
Supabase session, so the SDK's session management is the part we would spend
our time fighting. Five method handlers is less code than the adapter would
have been, and it keeps the dependency surface at zero for a security-
sensitive layer.

**Impact.** Protocol revisions are ours to track — `SUPPORTED_PROTOCOL_VERSIONS`
in `protocol.ts` is the list to update. The dispatcher is transport-free, so
a second transport reimplements only the route handler.

*2026-08-28 · Module 36*

---

## MCP-010 — Authentication and audit shipped in the foundation module

**Decision.** Module 36 includes the authorization checks, audit logging and
confirmation primitives, rather than deferring them to a separate module as
the original Phase 6 sketch proposed. Module 37 covers read tools instead.

**Reason.** An MCP endpoint that ships before its authorization layer is an
open hole in production for the length of one module. There is no version of
"foundation first, auth next" that is safe to deploy in between.

**Impact.** Recorded in Master Build Plan 12C under Module 36 as a
deliberate scope deviation rather than a silent one, since the module
boundaries were approved by the developer.

*2026-08-28 · Module 36*

---

## MCP-011 — Spend the confirmation before acting, not after

**Decision.** The dispatcher inserts the token's signature into
`mcp_confirmations` and only then runs the handler. The signature is the
table's primary key. A conflicting insert is `CONFLICT` and the action does
not run; a ledger that cannot be reached at all is `INTERNAL_ERROR` and the
action does not run either.

**Reason.** Verifying the signature proves an admin confirmed this exact
action. It does not prove the action has not already happened, because the
token stays verifiable for its whole five minutes — the gap MCP-006
recorded. Recording afterwards would not close it: two concurrent calls
would both pass the check and both write before either wrote its ledger
row. Ordering the insert first hands the race to Postgres, where a unique
constraint settles it, instead of to whichever request arrived first.

Failing closed on an unreachable ledger is the same argument. "We could not
check whether this already ran" and "this is the first time" are different
claims, and a destructive action must not proceed on the weaker one.

**Impact.** A third place on the MCP path reaches for the service-role
client, alongside the audit write and the rate limiter, recorded in 12B.2.
It takes no AI-supplied input: the signature written is one the server
computed itself. The table has RLS enabled with no write policy for anyone
— a ledger an administrator could delete from is a ledger an administrator
could defeat, and constraining what a confirmed admin action can do twice
is the entire point. Only the HMAC half of the token is stored; keeping the
assembled token would put a still-valid credential in a row.

*2026-08-29 · Module 38*

---

## MCP-012 — A status change is its own tool, never a field on an editor

**Decision.** `products_create` always creates a draft, `products_update`
carries the stored status forward, and neither schema accepts `status`.
Publishing and archiving are separate high-risk tools. The same split
applies to collection visibility and to builder-option activation.

**Reason.** 12B.6 makes publishing and archiving high-risk while an
ordinary field edit is not, and `risk` is declared per TOOL rather than per
argument. One editor that also set status would have to be either high —
demanding a confirmation ceremony to fix a typo, which trains an
administrator to approve without reading — or medium, which is an
unconfirmed publish tool wearing a different name. Neither is acceptable,
so there is no such tool.

**Impact.** Eleven catalogue tools rather than six, and a model that wants
to publish something must call a tool whose name says so. Activation is
medium while deactivation is high, an asymmetry that follows the same rule:
offering a new choice is additive and reversible, withdrawing one takes
away something a customer may be halfway through choosing.

*2026-08-29 · Module 38*

---

## MCP-013 — Omitting a field means "leave it alone"

**Decision.** The write tools merge what they were given onto the stored
record before validating it, and `images` and `productIds` treat an omitted
value as "do not touch". An explicitly empty list still clears them.

**Reason.** The admin form always posts every field, so the Server Actions
could safely read a missing image list as "no images". A tool call is the
opposite: an assistant asked to correct a description sends the
description. Had the tools kept the form's reading, that call would have
blanked the price, the SKU and every photograph — destruction performed by
a medium-risk tool that never asks for confirmation, on behalf of an
administrator who asked for a typo fix.

**Impact.** `replaceProductImages` and `syncCollectionProducts` return
early on `undefined` rather than deleting, and the SEO upsert reads the
existing row when given only one of its two columns. The admin UI is
unaffected — it still posts the whole record every time. The merge happens
before the domain schema runs, so the schema still validates the complete
record and 12B.11's "no second business-logic system" holds.

*2026-08-29 · Module 38*
