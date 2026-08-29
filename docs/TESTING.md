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
