# Security (Module 29)

The audit is `scripts/test-security.mjs`. It re-runs with the suite, which is the point: an audit
whose output is prose decays the moment someone changes a file.

Two rules it follows:

1. **Nothing destructive.** Probes read, or write rows the script created and then removes. It
   never blind-fires at all 118 Server Actions hoping they reject — the ones that didn't would
   mutate real data.
2. **Known gaps FAIL rather than being omitted.** That is what makes it an audit rather than a
   rubber stamp.

## What Pass 1 found

**No critical findings.** Twelve issues, all closed in Pass 2.

| Severity | Finding | Resolution |
| --- | --- | --- |
| HIGH | Three cron endpoints publicly callable | `authorizeCron()` fails closed |
| HIGH | No Content-Security-Policy | Report-only CSP shipped |
| HIGH | `audit_logs` written to by nothing | `logAudit()` on the sensitive mutations |
| MEDIUM | 952 ownerless cart rows | `reap_stale_carts()` on the monthly cron |
| MEDIUM | No `X-Frame-Options` / `X-Content-Type-Options` | Added |
| MEDIUM | Contact, consultation, newsletter unlimited | `checkRateLimit()` |
| LOW | No `Referrer-Policy` | Added |

### Verified as already correct

Secret hygiene (all 150 built client bundles scanned — no service-role key, Stripe secret or
`DATABASE_URL`), all 16 `createAdminClient()` call sites guarded, Stripe signature verification,
price integrity, cross-user isolation, and both `dangerouslySetInnerHTML` uses.

## The cron fix is the one worth understanding

Every cron route used to do:

```ts
const cronSecret = process.env.CRON_SECRET;
if (cronSecret) { /* check bearer token */ }
```

When `CRON_SECRET` was unset the check was **skipped entirely**. That was a deliberate
"unset = not configured yet" convenience, and it matched convention elsewhere in the project — but
these routes are not read-only. One emails customers. One deletes analytics rows. One now reaps
carts.

A missing environment variable in production silently turned "protected" into "open to anyone who
guesses the URL", and nothing in the code would have told you.

`authorizeCron()` now **fails closed in production**: 401 for a bad token, **503** when no secret
is configured at all. 503 rather than 401 because the caller did nothing wrong — the deployment is
misconfigured, and a 401 sends someone hunting for a bad token instead of a missing variable.

`CRON_SECRET` **must still be set before deploy.** Without it the crons return 503 and simply never
run, which is safe but not useful.

## Audit logging is deliberately narrow

`logAudit()` is called from the mutations where "who did this, and what was it before" is a
question someone will actually ask: refunds, order status changes, role assignment, settings.
Logging every write would produce a second copy of the database that nobody reads.

- **Service-role client**, because `audit_logs` is admin-only — an entry written through the
  caller's own client would fail for exactly the callers most worth recording.
- **Never throws.** Refusing a legitimate refund because a logging insert timed out is worse than
  the missing row. Failures go to the application log, which is stated here so nobody mistakes
  silence for "it definitely recorded".

## Rate limiting: what it is and is not

`lib/security/rate-limit.ts` generalises the chat limiter and reuses its table. **Table-backed,
not in-memory** — serverless instances don't share memory, so an in-process counter resets on every
cold start and enforces nothing.

Only a salted **hash** of the IP is stored. An IP is personal data under UK GDPR and this only
needs to recognise a repeat caller, never identify one.

**It fails open.** A customer unable to send an enquiry because a counter table blipped is worse
than one unthrottled request; failures are logged so a broken limiter doesn't stay invisible.

**Honest limits:** this throttles casual abuse and scripted floods from one source. It is **not** a
defence against a distributed attack from many addresses, and it is **not** a CAPTCHA.

## CSP is Report-Only, on purpose

An enforced policy that is even slightly wrong white-screens the storefront, and this app loads
three third-party pixels plus Next's inline bootstrap scripts.

**Verification done:** every external host referenced in the server-rendered HTML across seven
pages was extracted and checked against the policy — all allowed, none outside it. That check now
lives in the audit script permanently.

**What that verification is not:** it sees hosts in server-rendered markup. It does **not** see a
`fetch()` a client component makes after hydration, because no browser runs here. That is exactly
why the policy ships Report-Only.

**To enforce:** deploy, watch real violation reports, then change the header name from
`Content-Security-Policy-Report-Only` to `Content-Security-Policy` in `next.config.mjs`. That is
the whole change.

`'unsafe-inline'` and `'unsafe-eval'` remain in `script-src` and are called out rather than buried:
Next injects inline bootstrap scripts, and removing the allowance needs per-request nonces threaded
through the document. That belongs to whoever enforces the policy. As written it still blocks
foreign script hosts, framing, form hijacking and base-tag injection.

## Cart reaping

Middleware issues a `cart_session` cookie to every visitor and `get_or_create_cart()` writes a row
for it — so the table grew with **page views**, not orders. The audit found 952 ownerless carts in
a database that has never seen real traffic.

`reap_stale_carts()` deletes a row only when **all four** hold: no `customer_id`, status still
`active`, **no `cart_items`**, and older than the cutoff (72h on the cron).

The third condition is the important one. **A guest cart with items in it is a sales lead**, and
reaping it would destroy business data to save a row. The audit asserts both directions — that a
stale empty cart is deleted *and* that a stale cart with items survives.

Execute is granted to `service_role` only. `0058` revoked it from `public`, which also stripped
`service_role` (it inherits through PUBLIC) and broke the cron; `0059` grants it back by name,
which is the correct end state rather than a workaround.

## Two things the audit got wrong about itself

Worth recording, because a security tool that cries wolf trains you to skim past the word CRITICAL:

1. **A false CRITICAL.** The check for "does checkout read `unit_price_snapshot`" matched the
   *comment* saying the value is deliberately ignored. Verified by hand that no code path reads it,
   then made the check strip comments first.
2. **Two checks measured the environment, not the code.** The cron check asserted `CRON_SECRET` was
   set; the cart check asserted the table was small. Both now assert behaviour — that an
   unauthorised caller is refused, and that the reaper deletes the right rows and keeps the wrong
   ones.

## MCP and the assistant (Module 43)

This audit predates the MCP track by seven modules and had nothing to say
about it. What follows is the boundary as built, and `test-mcp-abuse.mjs`
asserts each claim rather than describing it.

**There is no MCP credential.** No API key, no service account, no second
user store. A caller presents the application's own Supabase session —
the auth cookie from a browser, or a Bearer access token from an external
client — and the role is read from `profiles` server-side on every
request. Nothing about the caller's identity is taken from the request
body, so an assistant cannot name a person and be believed.

**Three checks in this order, on every call:** authenticated, then an
admin role, then the tool's own permission read from `role_permissions`
in the database. Order matters — a caller with no right to a tool learns
that and nothing about the tool's arguments. Underneath all of it every
handler queries with the CALLER'S client, so RLS refuses independently of
whether the application layer got it right.

**The AI never gets a query builder.** No `execute_sql`, no tool that
takes a table name, no filesystem, no shell, no arbitrary HTTP (12B.15).
The registry is the list of what can happen, and the dispatcher can only
reach a name that is in it.

**High-risk actions do not execute on the first call.** They describe
what they would do and return a signed token, which the dispatcher spends
against a ledger BEFORE acting, so two concurrent calls carrying one
token cannot both win. In the admin chat the model never holds that
token at all: the loop stops, a person clicks Approve, and the server
supplies a fresh token that never crosses the network.

**What reaches the logs is redacted.** Values under keys matching
password/secret/token/api-key/authorization/cookie/session are dropped
before an audit or failure row is written, long strings truncated, depth
capped. Redaction is by key name, never by guessing what a secret looks
like.

**Refusals are now persisted.** Until Module 43 an authorization failure
on a read tool existed only as a console line. It is now a row with the
actor, the tool, the code and the redacted arguments, readable at
`/admin/assistant/activity` by `settings.manage`, on a table with no
insert, update or delete policy for anyone.

**Known weak points, stated rather than implied.** The rate limiter fails
open on its own failure; it counts per actor and per address, so it is
not a defence against a distributed attack. The body-size check reads
`content-length`, so a request omitting the header is bounded only by the
platform limit. The stdio adapter's token expires and is not refreshed.
The assistant has never been run against a live model on this deployment.

## Known limitations

- **End-to-end price integrity is not proven.** Driving `placeOrder` from a script needs the cart
  cookie, auth cookie and Server Action wire format to align, and they don't here. Price integrity
  is asserted at **source level**: the order is built from `products.base_price` and no code path
  in `placeOrder` reads the client-writable snapshot. The script prints an explicit SKIP rather
  than a false pass.
- **Rate limiting is per-source**, not distributed (see above).
- **No external scanning or penetration testing** was performed. This is a code and configuration
  review.
- **CSP is not enforced yet** (see above).

## Running it

```
npm run build > .m29/build-p2.log 2>&1   # the bundle scan needs a build
node --env-file=.env.local scripts/test-security.mjs
```
