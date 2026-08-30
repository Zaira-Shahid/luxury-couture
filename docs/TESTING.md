# Testing (Module 30)

## The layers, and what each is actually for

| Layer | Where | What it proves |
| --- | --- | --- |
| **Unit** | `scripts/unit/*.test.mjs` (54) | Pure logic, no I/O. Run by `node:test`. |
| **Integration + RLS** | `scripts/test-*.mjs` (37) | Real HTTP, real Supabase sessions, real policies. |
| **Coverage matrix** | `scripts/test-flows-coverage.mjs` | That each of the 15 critical flows has a named script. |
| **Regression gate** | `scripts/run-suite.mjs --diff` | That the numbers did not move. |

**No test framework was added.** Unit tests use Node's built-in `node:test`, so the devDependency
list is unchanged — which matters in a project that had just removed a 5.4 MB dependency in
Module 28. `scripts/test-unit.mjs` translates TAP into this project's `PASS —`/`FAIL —` format so
`run-suite.mjs` counts it natively, rather than teaching that script a second format and risking
how it counts the other 35.

## `test-mcp.mjs` — a script with two halves (Module 36)

The MCP suite is the one integration script that also unit-tests. Its Part A imports
`lib/mcp/protocol.ts`, `registry.ts`, `confirm.ts`, `redact.ts` and `result.ts` directly under
Node's type stripping and asserts the invariants that must hold before any request arrives —
which is why those five modules were deliberately written free of `@/...` imports, following the
rule already set by `lib/auth/permissions.ts` and `lib/ai/guardrails.ts`.

Part B then drives the live `/api/mcp` endpoint with real `super_admin`, `admin`, `production`
and `customer` sessions, over both the cookie and Bearer transports.

`test-mcp-read.mjs` (Module 37) and `test-mcp-write.mjs` (Module 38) follow the same two-part
shape. The write suite is the first in this project where a failing assertion means data was
CHANGED that should not have been, so it never believes a response: after every write it reads
the row back through the service-role client. Three things carry its weight — the replay ledger
(the same confirmation token archives a product once, the second attempt is `CONFLICT`, and two
concurrent confirmed calls race for one token where exactly one must win), omission-is-not-
deletion (a one-field update must leave the price, the SKU and the photographs standing), and the
fact that no argument to an editor can reach `status`.

`test-mcp-orders.mjs` (Module 39) adds a third. Its weight sits on rules this project did not
have before: the order and production pipelines were validated for enum membership and nothing
else, so a delivered order could be walked back to pending and a garment at finishing could be
sent to cutting. Most of the script is the negative half of the rules that now exist — every
backward move, every reopened terminal state, every cancellation of a shipped order — each
asserted against the row afterwards rather than against the response.

Two of its checks exist to catch this module over-reaching. The admin forms pass
`allowCorrection: true` and must keep doing so, because an admin correcting a mis-click is
exactly who should be able to move an order backward; the tools must never pass it. And the QC
split of migration 0054 is checked in both directions: a `production` account cannot record a
quality check, a `qc` account cannot move the work.

`test-mcp-content.mjs` (Module 40) is the fourth. Its weight sits on rules that must hold
against a caller looking for a way around them rather than against a bug. 12B.12 forbids
publishing AI-written copy automatically, so the script hunts the loophole: `status`,
`publishedAt`, `aiGenerated` and `ai_generated` are each sent to the drafting tool and each must
be refused as an unknown field, and a database-wide count then asserts that no AI-generated post
is published anywhere. The same shape covers the settings namespace — `site_settings` holds the
currency and the theme beside the SEO defaults, so the script tries to write `store.currency`
through the SEO editor and checks the currency afterwards.

One of its checks exists because the script broke the site while being written. `seo_set_indexing`
blocks search engines for the whole site; a run that left it blocked would delist the storefront
and fail every later SEO script in the suite. So the original value is captured before anything
runs and restored in the cleanup unconditionally. Writing that test also caught a real defect:
the service read an absent setting as "indexed" when this project's default is the opposite.

`test-mcp-analytics.mjs` (Module 41) is the fifth, and the shortest, because four of its five
tools are refusals for most accounts. Its centre is the permission split: the `marketing` role
holds `analytics.read` and none of `orders.read`, `payments.read` or `customers.read`, so the
script points that one account at all five tools and asserts it reaches exactly one. `finance` is
pointed at the same five to catch the opposite error — it holds orders and payments but not
customers.

The numbers are checked against arithmetic the script did itself, on rows it created: three
orders of known value, two succeeded payments and one pending payment that must not appear in
revenue. A reporting tool that returns a confident wrong total is worse than one that fails,
because an assistant will repeat it.

"Aggregates only" is checked against a real seeded customer — their email and id, and the ids of
the orders they placed — rather than against a regex for what an email looks like. The rule is
that this specific person cannot be found in an analytics answer.

`test-admin-assistant.mjs` (Module 42) is the sixth, and the first that tests a LOOP rather than
an endpoint. Nothing it does spends an API call: the model is a script of canned responses, so
each check names one model output and asserts what the loop did with it. Everything under the
loop is real — the registry, the dispatcher, the permission check, the HMAC tokens, the replay
ledger, the audit write.

That needed a harness. `scripts/lib/ts-node-hook.mjs` teaches Node's own type stripping this
project's `@/` alias and TypeScript's extensionless imports, so `src/lib/mcp/chat.ts` can be
imported and driven directly; `scripts/unit/*.test.mjs` already import `.ts` modules this way,
but only ones with no imports of their own. Only `react` is substituted, and only its `cache`
function, which the auth chain pulls in.

Its centre is the claim the module is built on: the model never holds a confirmation token. A
high-risk call must stop the loop with nothing archived, the returned conversation must contain
no token anywhere in it, and the model must not be asked to continue. Approval is tested from
the other side — the action runs exactly once, the signature lands in the replay ledger, the
write lands in `audit_logs`, and an approval pointed at a tool the registry does not call high
risk is refused BEFORE anything is dispatched. That last check exists because the first draft
did dispatch first, which would have executed a low-risk write and then reported that nothing
had changed.

The rest is the negative half: a customer refused, an anonymous request refused, an over-long
message refused before the model is reached, a malformed approval not treated as an approval,
and a model that never stops ending the turn as a failure rather than as an answer.

`test-mcp-abuse.mjs` (Module 43) is the seventh, and the only one that asks the endpoint
IMPROPERLY on purpose: anonymous, with a forged bearer token, from a customer account, as a
batch, as malformed JSON, with an unknown method, with an unknown tool name, with a megabyte of
padding, with two hundred levels of nesting, and with a SQL-shaped id.

Asserting the refusal is only half of it. The other half is that the refusal was WRITTEN DOWN —
which is the change Module 43 makes, since a `FORBIDDEN` on a read tool used to be persisted
nowhere at all. So each probe is followed by a service-role read of `mcp_tool_failures` asserting
the row exists, names the role that was refused, and carries the arguments that caused it; and
three successful pings are followed by a read of `mcp_tool_stats` asserting the counter moved and
that three calls did not become three rows.

The rate-limit probe gets its own account, because it deliberately exhausts a window and would
otherwise throttle every check after it. The load pass is PRINTED, not asserted: ten concurrent
calls with p50/p95, so a change that makes every call five times slower is visible, without a
threshold tuned on one laptop failing on someone else's.

It also drives `scripts/mcp-stdio.mjs` end to end — a real `tools/list` through the pipe, plus a
notification that must produce no output at all — and asserts by reading the source that the
adapter never grows a registry import, since that is the line between a proxy and a second
security model.

**Most of it is negative, and that is the design.** The checks that matter are: an anonymous
caller refused, a customer refused, a production account refused a tool it was never shown
(hiding a tool is not the enforcement), twelve shapes of `execute_sql`/`shell`/`read_file`
answered as unknown tools, and no response containing a key, a Postgres error code or a stack
trace. A tool layer that grants correctly but revokes nothing reads as protection while providing
none — the standard Module 26 set.

It lives in `test-*.mjs` rather than `unit/` because the half that proves the security model
needs a real database, real RLS and real sessions; splitting it would put the two halves of one
argument in two places.

## Why the coverage matrix exists

Asked "are the critical flows tested?", the honest answer before Module 30 was "probably — there
are 1245 assertions". That is not an answer.

Keyword-grepping is *worse* than no answer: the word "order" appears in 25 scripts, almost all
incidentally, so a naive matrix reports near-total coverage regardless of what is exercised.

So `test-flows-coverage.mjs` names, per flow, a **specific script** and **specific assertion
strings** that must appear in it. If a script stops making that assertion — deleted, renamed,
quietly weakened — the matrix fails and names the flow that lost its cover.

It found two genuine gaps and one of its own mistakes:

- **Registration was never tested.** Zero of the 34 scripts called `signUp()`.
- **Product browsing** was covered only incidentally.
- **Deposit** was pointed at `test-payments.mjs`, which only ever uses `type: "full"` and never
  exercises a partial payment. The deposit *rules* live in `test-settings-pass2.mjs`; the matrix
  now points there.

## Registration: why it went untested, and what is still not covered

`auth.admin.createUser({ email_confirm: true })` is what all 30 other scripts use. It is the right
choice for them — fast, deterministic, and it never touches Supabase's rate-limited mail sender.

But it bypasses the zod validation, the public `signUp()` call, the confirmation gate and referral
redemption. **The one flow every customer must pass through was the one flow never exercised as a
customer.**

**And it turns out it cannot be fully tested here at all.** Probing established why:

| Domain | Result |
| --- | --- |
| `@luxury-couture-devtest.local` | "Email address is invalid" |
| `@devtest.example` (RFC 2606) | "Email address is invalid" |
| `@luxury-couture-devtest.com` | "Email address is invalid" |

Supabase Auth validates that the address's domain actually resolves, so **no synthetic address
passes**. `admin.createUser` skips that check — which is the real reason the other 30 scripts use
it, not merely the mail rate limit. An earlier version of this document blamed the rate limit; that
was wrong, and the rate-limit error had been masking the validation error underneath it.

Testing `signUp` end-to-end therefore needs a real mailbox, which does not belong in an automated
suite: it would send genuine mail on every run and create accounts on a live address.

**So the split is:**

- **Skipped, with the reason stated:** the `signUp` call itself, and the confirmation-gate shape
  that depends on it.
- **Genuinely proven:** the register page's fields, the zod validation cases, the referral wiring,
  and `handle_new_user` — the trigger is exercised through `admin.createUser`, which *does* pass
  validation, and asserts the profile row, the default `customer` role, the `full_name` metadata
  path and the marketing unsubscribe token.

One check in this file was caught passing **vacuously**: the confirmation-gate assertion keyed off
"some account exists", and once the trigger section started creating accounts it passed because
`signUp` had *errored* rather than because the gate works. It is now guarded on `signUp` having
actually run. A check that passes because the thing it tests never ran is worse than no check.

## What is deliberately NOT here

**Component tests.** They would need Vitest, jsdom and Testing Library — three dependencies — and
this app's components are overwhelmingly server components rendering data, which the HTTP-level
tests already assert against real rendered HTML more faithfully than jsdom would. The genuinely
interactive pieces are a handful of `useTransition` form wrappers.

**Browser E2E (Playwright).** Chromium is not installed in this environment and Playwright would
download ~300 MB of browsers. The existing tests drive real sessions, real Server Actions and real
RLS over HTTP; what they miss is client-side JS behaviour. Playwright is the right tool for that in
a CI pipeline — it is not installed here rather than installed and producing tests that cannot
honestly be run.

Both were decisions taken with the owner, not omissions.

## A finding from writing the browsing tests

**The storefront product listing has no pagination and no user-controlled sort.**
`getPublishedProducts()` accepts a `limit`, but `/products` never passes one and there is no offset
or range anywhere — every published product renders on one page, ordered by `published_at`
descending.

That is fine for a boutique catalogue and will stop being fine at some size. It is *reported* by
`test-browsing.mjs` rather than tested, because testing a feature that does not exist is how a
coverage matrix starts lying.

The browsing tests do assert the thing that carries real risk: **a draft product must not appear**
in the listing, under a category filter, via search, or on its own detail page (which correctly
returns 404).

## Running it

```
node scripts/test-unit.mjs                                  # unit, no server needed
node scripts/test-flows-coverage.mjs                        # matrix, no server needed
node --env-file=.env.local scripts/test-registration.mjs    # needs a server
node --env-file=.env.local scripts/test-browsing.mjs        # needs a server
node --env-file=.env.local scripts/run-suite.mjs            # everything
```

The regression gate is `run-suite.mjs --diff before.txt after.txt`. The bar is **not** "the tests
still pass" — it is *the same numbers*. A script quietly dropping from 44 checks to 40 because a
setup step started failing would otherwise read as a pass.
