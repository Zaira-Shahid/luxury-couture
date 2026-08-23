# Testing (Module 30)

## The layers, and what each is actually for

| Layer | Where | What it proves |
| --- | --- | --- |
| **Unit** | `scripts/unit/*.test.mjs` (54) | Pure logic, no I/O. Run by `node:test`. |
| **Integration + RLS** | `scripts/test-*.mjs` (36) | Real HTTP, real Supabase sessions, real policies. |
| **Coverage matrix** | `scripts/test-flows-coverage.mjs` | That each of the 15 critical flows has a named script. |
| **Regression gate** | `scripts/run-suite.mjs --diff` | That the numbers did not move. |

**No test framework was added.** Unit tests use Node's built-in `node:test`, so the devDependency
list is unchanged — which matters in a project that had just removed a 5.4 MB dependency in
Module 28. `scripts/test-unit.mjs` translates TAP into this project's `PASS —`/`FAIL —` format so
`run-suite.mjs` counts it natively, rather than teaching that script a second format and risking
how it counts the other 35.

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

Two things had to change to test it at all:

1. **The test domain.** Supabase's public `signUp` validates the address and rejects a `.local`
   TLD outright, while `admin.createUser` accepts it — very likely *why* this path went untested.
   `test-registration.mjs` uses `@devtest.example`; `.example` is reserved by RFC 2606 and can
   never route to a real inbox.
2. **Cleanup is explicit**, because `purgeDevtestData` filters on the `.local` domain and will not
   match these accounts.

**Still not covered, and stated rather than implied:** Supabase's built-in SMTP allows roughly two
messages an hour, shared with password reset. When that limit is hit, the signUp assertions record
**SKIP** — not a pass, and not a failure. Reporting an environment condition as either would be
dishonest in opposite directions. Email delivery itself is never asserted.

This is the same wall that blocked the password reset in Module 29. It resolves when custom SMTP is
configured, which is already a standing launch blocker.

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
