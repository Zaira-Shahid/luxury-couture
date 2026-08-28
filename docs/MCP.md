# MCP — the AI application control layer

Module 36. The authoritative architecture record is section 12B of
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

Module 36 ships three, all read-only. Domain tools arrive per module
(Master Build Plan 12C).

| Tool | Permission | What it does |
| --- | --- | --- |
| `system_ping` | any admin role | connection check; server time and protocol version |
| `system_whoami` | any admin role | the caller's own id, role and permission list |
| `system_diagnostics` | `settings.manage` | registry contents and which integrations are configured, as booleans |

## Adding a tool

1. Create or open `src/lib/mcp/tools/<domain>.ts`. One file per domain —
   never one file holding everything.
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
4. Call the existing service (`src/lib/<domain>/` to read,
   `src/features/<domain>/actions.ts` to write) through `ctx.supabase`.
   Do not write a second implementation of the mutation.
5. Add tests to `scripts/test-mcp.mjs`, including the negative half: wrong
   role, missing permission, invalid input.

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
npm run build && npx next start          # the suite needs a running server
node --env-file=.env.local scripts/test-mcp.mjs
```

124 assertions. Part A unit-tests the protocol parser, registry invariants,
confirmation tokens, redaction and result envelopes by importing the `.ts`
modules directly. Part B drives the live endpoint with real signed-in
`super_admin`, `admin`, `production` and `customer` accounts, over both the
cookie and Bearer transports.

## Known limitations

- Only system tools exist so far; domain tools arrive per module.
- A confirmation token is single-ACTION but not single-USE within its
  5-minute life. The replay ledger lands in Module 38 with the first
  destructive tool.
- No stdio transport, so an external client needs a real user access token.
- Rate limiting throttles a loop; it is not a defence against a distributed
  attack.
