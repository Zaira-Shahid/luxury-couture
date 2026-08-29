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

Twenty-eight, added per module (Master Build Plan 12C). Everything the AI
can do in this application is this list and nothing else.

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

Two shapes recur and are deliberate.

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
