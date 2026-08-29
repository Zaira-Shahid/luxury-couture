# MCP — the AI application control layer

Modules 36-38. The authoritative architecture record is section 12B of
`Luxury-Lehenga-Master-Build-Plan.md`; this document is the working
reference for someone about to add a tool or debug a call.

## What this is

An authorized member of staff gives an instruction in natural language and
an AI assistant carries it out inside this application — but only through
tools that exist in a registry, take validated arguments, check the
caller's real permissions, and record what they did.

```
Admin (real Supabase session)
   -> AI assistant
   -> POST /api/mcp            JSON-RPC 2.0
   -> lib/mcp/server.ts        dispatch
   -> tool registry            the tool must exist
   -> Zod validation           the arguments must fit
   -> authorization            the human must hold the permission
   -> confirmation gate        high-risk actions do not run unasked
   -> application service      the same code the admin UI calls
   -> Supabase                 RLS, as the caller
```

## What the AI cannot do

Permanently, by design (section 12B.15):

- run SQL — there is no `execute_sql` and no tool that takes a table name
- run a shell command, read a file, or make an arbitrary HTTP request
- read an environment variable or obtain any key
- reach Supabase other than through a registered tool, under the caller's
  own session, with RLS applied

`scripts/test-mcp.mjs` asserts each of these against the live endpoint as a
`super_admin` — the account most likely to be assumed exempt.

## Authentication

The caller presents the application's own Supabase session. Two transports,
one identity model:

| Client | Header |
| --- | --- |
| Browser (Module 42 admin chat) | the `sb-<ref>-auth-token` cookie |
| External MCP client | `Authorization: Bearer <access token>` |

There is no MCP API key and no service account. The actor is a real person,
so their role and permissions are the ones the admin UI would give them, and
the audit trail names them.

Anonymous callers get `401`. Signed-in customers get `403` — `initialize`
included, so there is nothing to discover without an account.

## Authorization

Three checks, in this order, on every call:

1. authenticated, verified against Supabase Auth
2. holds an admin role, read from `profiles` server-side
3. holds the tool's `permission`, read from `role_permissions`

Tools are also filtered out of `tools/list` when the caller lacks the
permission — but that is only so an assistant is not tempted by tools it
cannot use. **The list filter is not the enforcement.** Calling an unlisted
tool by name is refused by check 3, and the suite tests exactly that.

No MCP-specific permission key exists. Tools reuse the 23 keys in
`src/lib/auth/permissions.ts`.

## The methods

| Method | Behaviour |
| --- | --- |
| `initialize` | negotiates the protocol version, returns server info |
| `notifications/initialized` | notification — answered with `202`, no body |
| `ping` | liveness; empty result |
| `tools/list` | permission-filtered tool list with generated JSON Schemas |
| `tools/call` | runs one tool |

No resources, no prompts, no sampling, no SSE. Batch requests are refused
rather than partially processed. `GET` returns `405`.

## The tools

Fifty, added per module (Master Build Plan 12C). Everything the AI can do
in this application is this list and nothing else.

**System (Module 36)**

| Tool | Permission | What it does |
| --- | --- | --- |
| `system_ping` | any admin role | connection check; server time and protocol version |
| `system_whoami` | any admin role | the caller's own id, role and permission list |
| `system_diagnostics` | `settings.manage` | registry contents and which integrations are configured, as booleans |

**Read (Module 37)** — fourteen tools: `products_list/_get`,
`collections_list/_get`, `builder_options_list/_get` (`catalog.read`);
`orders_list/_get` (`orders.read`); `enquiries_list/_get`
(`enquiries.read`); `customers_search/_get` (`customers.read`);
`production_list/_get` (`production.read`). All `risk: "low"`, all reading
the ADMIN view — drafts and archived rows included.

**Write (Module 38)** — eleven tools, all `catalog.write`:

| Tool | Risk | What it does |
| --- | --- | --- |
| `products_create` | medium | creates a DRAFT product; cannot publish |
| `products_update` | medium | edits fields; cannot change status |
| `products_publish` | high | draft/archived -> published |
| `products_archive` | high | -> archived; deletes nothing |
| `collections_create` | medium | creates an INACTIVE collection |
| `collections_update` | medium | edits fields and membership; cannot change visibility |
| `collections_set_visibility` | high | shows or hides a collection |
| `builder_options_create` | medium | adds an INACTIVE builder option |
| `builder_options_update` | medium | edits one; cannot activate it |
| `builder_options_activate` | medium | offers it to customers |
| `builder_options_deactivate` | high | withdraws it; the record and its history stay |

**Write (Module 39)** — seven tools across three domains:

| Tool | Permission | Risk | What it does |
| --- | --- | --- | --- |
| `orders_update_status` | `orders.write` | high | moves an order FORWARD; emails the customer |
| `orders_cancel` | `orders.write` | high | cancels an unshipped order; issues no refund |
| `orders_add_note` | `orders.write` | medium | internal note; the customer never sees it |
| `production_advance_status` | `production.write` | medium | moves a job forward through the twelve stages |
| `production_record_qc` | `qc.write` | medium | records an inspection result; moves nothing |
| `production_update_details` | `production.write` | medium | team and target date |
| `enquiries_update_status` | `enquiries.write` | medium | moves an enquiry forward |

**Forward only.** Orders, production jobs and enquiries move down their
pipeline and never back up. Stages may be SKIPPED, because the business
skips them — a ready-to-wear piece never enters production. Terminal
states (`delivered`, `cancelled`, a closed enquiry) cannot be reopened by
any tool. The rules live in `src/lib/orders/transitions.ts`,
`src/lib/production/transitions.ts` and
`src/lib/enquiries/write-enquiries.ts`.

The admin UI is NOT held to these rules — it passes `allowCorrection:
true` and can still set any status. An admin correcting a mis-click is
exactly who should be able to move an order backward; an assistant cannot
tell a mistake from an instruction.

**QC records, production moves, and neither can do the other.** Migration
0054 gave `qc.write` its own INSERT policy on `production_status_history`
so a QC user could record a result without moving work. The tools keep
that split: `production_record_qc` writes a history row at the job's
current stage and changes no status, and a `production` account cannot
call it.

**Write (Module 40)** — ten content and SEO tools, and the permission
column is the one to read carefully:

| Tool | Permission | Risk | What it does |
| --- | --- | --- | --- |
| `content_get_homepage` | `content.write` | low | hero copy, imagery, homepage SEO |
| `content_list_banners` | `marketing.write` | low | every banner, hidden ones included |
| `content_create_banner` | `marketing.write` | medium | creates a HIDDEN banner |
| `content_update_banner` | `marketing.write` | medium | text, link, schedule; cannot show it |
| `content_set_banner_active` | `marketing.write` | high | shows or hides one |
| `content_draft_blog_post` | `content.write` | medium | saves a marked AI DRAFT; cannot publish |
| `seo_get_settings` | `content.write` | low | the site-wide SEO defaults |
| `seo_update_settings` | `settings.manage` | medium | titles, descriptions, OG image, handles |
| `seo_set_indexing` | `settings.manage` | high | allows or blocks search indexing site-wide |
| `seo_update_override` | `content.write` | medium | one product/collection/page/post's metadata |

**A tool takes the permission its TABLE requires, not its page.** Module
37's rule was the page's permission, and for the catalogue, orders and
production the route gate and the RLS policy agree. They do not here:
`/admin/seo` and `/admin/marketing` are reachable with `content.write`,
while migration 0054 gates `site_settings` on `settings.manage` and
`promotional_banners` on `marketing.write`. A tool declaring the route's
key would be listed for a role the database then refuses — a tool that
appears to exist and fails on use. (The same mismatch means a marketing
user can open /admin/seo today and have every save refused. That is a
pre-existing bug in the admin UI, recorded in 12B.14.)

**AI-drafted content is never published and always marked.** 12B.12
forbids automatic publication of AI-written copy.
`content_draft_blog_post` has no `status` argument and no `ai_generated`
argument, so the rule is enforced by absence rather than by a check:
every post it writes is a draft flagged `ai_generated` (migration 0064).
No MCP tool anywhere can publish content — that stays a person's action
in /admin/content, which is also the review step.

****Read (Module 41)** — five reporting tools, and the permission column
is again the one to read carefully:

| Tool | Permission | What it does |
| --- | --- | --- |
| `analytics_sales_summary` | `payments.read` | revenue, payment count, average, vs previous period |
| `analytics_order_summary` | `orders.read` | orders placed in a window, value, count per status |
| `orders_pending_summary` | `orders.read` | what is open right now, and the oldest one |
| `analytics_customer_summary` | `customers.read` | customer counts, new in period. COUNTS ONLY |
| `analytics_events_summary` | `analytics.read` | event totals and the conversion funnel |

**Only one analytics tool takes `analytics.read`.** Migration 0054 gates
that key on `analytics_events` alone — orders, payments and profiles each
need their own. The `marketing` role holds `analytics.read` and none of
the other three, so the four commercial summaries declare the key their
TABLE requires rather than the one their name suggests. This is MCP-017
applied a second time.

**Aggregates only.** No reporting tool returns a customer, a name, an
email or a list. `analytics_customer_summary` uses head-only counts, so
no profile row is fetched at all — there is nothing to leak rather than
something filtered out. Use `customers_search` to find a person.

**What the numbers mean.** Revenue is SUCCEEDED payments only, so pending
money is not counted. Status breakdowns include the statuses with zero,
because an absent key and a genuine zero are different claims. A period
with no previous activity reports `changePercent: null` rather than a
percentage against zero.

Two shapes recur and are deliberate.**

**A status change is never a field on an editor.** Publishing and
archiving are high-risk under 12B.6 and a description edit is not, and
`risk` is declared per tool — so they are separate tools. `status` is not
in the editors' schemas at all, and a call that sends one is a
`VALIDATION_ERROR`.

**Omitting a field leaves it alone.** The updaters merge onto the stored
record. `images` and `productIds` omitted means "do not touch"; an
explicitly empty list is the way to genuinely clear them.

## Adding a tool

1. Create or open `src/lib/mcp/tools/<domain>.ts`. One file per domain —
   never one file holding everything. A domain may split read from write
   once it is large enough to need it, as `catalog.ts` /
   `catalog-write.ts` do.
2. Export a `ToolDefinition`:

```ts
{
  name: "products_update",        // <domain>_<action>, lower snake case
  title: "Update product",
  description: "...",             // the model reads this; say what it refuses too
  kind: "write",                  // read | write
  risk: "medium",                 // low | medium | high
  permission: "catalog.write",    // an existing key; required for writes
  inputSchema: z.object({ ... }).strict(),
  handler: async (input, ctx) => ({ action: "Product updated", data, target })
}
```

3. Append it in `src/lib/mcp/tools/index.ts`.
4. Call the existing service through `ctx.supabase` — `src/lib/<domain>/`
   to read, and to write. Do not write a second implementation of the
   mutation, and do not call the Server Action: an action redirects and
   revalidates, which only makes sense with a browser on the other end.
   Where the mutation still lives inside an action, extract it into
   `src/lib/<domain>/` and have the action call it too (Module 38 did
   this for the catalogue and builder writers).
5. Add tests to the module's suite — `test-mcp.mjs`, `test-mcp-read.mjs`
   or `test-mcp-write.mjs` — including the negative half: wrong role,
   missing permission, invalid input, and for a write, the database
   checked afterwards rather than the response believed.

`buildRegistry()` enforces at import time — so a violation fails the build,
not a production call — that names follow the convention, are unique, that
write tools declare a permission, and that high-risk tools are writes with a
`describeImpact()`.

Use `.strict()` on every schema. It is what makes an unexpected argument a
validation error rather than a silently ignored one.

## High-risk actions

A tool with `risk: "high"` does not execute on the first call. It returns
the impact and a `confirmationToken`; only a second call carrying that token
runs. The token is an HMAC over tool + arguments + actor with a 5-minute
TTL, so it cannot be replayed against different arguments, a different tool,
or by a different user.

Which actions must be high risk is listed in section 12B.6 — deletion, bulk
changes, refunds and payment status, order totals and cancellation,
permissions, and publishing major content.

Signed with `MCP_CONFIRMATION_SECRET`, falling back to
`SUPABASE_SERVICE_ROLE_KEY`. With neither, high-risk actions are refused
rather than run unconfirmed.

**A token is spent once (Module 38).** The signature check proves an admin
confirmed this exact action; it does not prove the action has not already
run, because the token stays verifiable for its whole five minutes. So the
dispatcher records the token's signature in `mcp_confirmations` BEFORE
running the handler, and the signature is that table's primary key: two
concurrent calls carrying the same token cannot both write, and the second
gets `CONFLICT`. A ledger it cannot reach fails the action closed — "we
could not check" is not "this is the first time". The table has RLS on
with no write policy at all, because a ledger an administrator could
delete from is one they could defeat.

## Errors

Tools return one of: `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`,
`VALIDATION_ERROR`, `CONFLICT`, `BUSINESS_RULE_ERROR`,
`CONFIRMATION_REQUIRED`, `RATE_LIMITED`, `INTEGRATION_ERROR`,
`INTERNAL_ERROR`.

Postgres failures are mapped by error CODE, never by message text — `42501`
(an RLS refusal) becomes `FORBIDDEN`, `23505` becomes `CONFLICT`. Anything
unrecognised becomes `INTERNAL_ERROR` with a fixed sentence. Stack traces,
SQL, table names and secrets go to the server log only.

A failed call always says "No changes were made." explicitly.

## Audit and observability

Every call is logged to the application log: request id, tool, kind, risk,
actor, role, status, duration. No argument values.

Every **write** call additionally writes to `audit_logs` — the same table
the admin UI uses, so "who changed this" has one answer — with
`action = mcp.<tool_name>`, the entity, a redacted input summary and the
outcome. Failures are recorded too.

Reads write no audit row, by design and by test.

Redaction (`src/lib/mcp/redact.ts`) removes values under any key matching
password/secret/token/api key/authorization/cookie/session, truncates long
strings, caps long arrays and caps depth.

## Rate limiting

60 calls per 10 minutes, counted per **actor** rather than per IP, reusing
`checkRateLimit()` and the existing `chat_rate_limits` table. The realistic
failure here is one assistant looping, not an anonymous flood, and counting
by user means one admin's loop cannot throttle a colleague on the same
office connection.

## Testing

```
npm run build && npx next start          # the suites need a running server
node --env-file=.env.local scripts/test-mcp.mjs         # 127 — the foundation
node --env-file=.env.local scripts/test-mcp-read.mjs    # 245 — the read tools
node --env-file=.env.local scripts/test-mcp-write.mjs   # 239 — the write tools
```

Each has the same two halves. Part A asserts invariants at the source —
the protocol parser, registry rules, confirmation tokens, the reader
contract, and in `test-mcp-write.mjs` the fact that the dispatcher spends
a confirmation before it acts. Part B drives the live endpoint with real
signed-in accounts of every relevant role, over both the cookie and Bearer
transports.

`test-mcp-write.mjs` is the first suite where a failing assertion means
data was changed that should not have been, so it checks the DATABASE
after every write rather than believing the response. Its centre is the
replay ledger: the same token archives a product once, a second attempt is
`CONFLICT`, and two concurrent confirmed calls race for one token where
exactly one must win.

## Known limitations

- Catalogue writes only. Orders, production, content, SEO and analytics
  are readable but not writable; those tools arrive with Modules 39-41.
- No customer-facing tools. Every registered tool is admin-audience;
  the customer set is specified in 12B.16 and scheduled as Module 44.
- Writes are audited but not diffed: the audit row records the request,
  the outcome and the record touched, not the previous value of every
  field.
- No stdio transport, so an external client needs a real user access token.
- Rate limiting throttles a loop; it is not a defence against a distributed
  attack.
