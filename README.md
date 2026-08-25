# Luxury Lehenga Couture

A made-to-measure bridal and occasion-wear storefront for the UK market, with a full back office
behind it. Customers browse a catalogue, design a piece from scratch in a nine-step builder, book a
consultation, request a quotation, and follow the order through production to delivery. Staff run
the whole business — catalogue, orders, payments, production, shipping, marketing and content —
from one admin panel with per-role permissions.

Built module by module against
[`Luxury-Lehenga-Master-Build-Plan.md`](./Luxury-Lehenga-Master-Build-Plan.md), which remains the
source of truth for scope and sequencing. **Modules 0–31 are complete**; Module 32 is production
deployment.

---

## Stack

| | |
|---|---|
| Framework | Next.js 15 (App Router, Server Components, Server Actions) |
| Language | TypeScript, React 18 |
| Styling | Tailwind CSS v4, shadcn/ui on Base UI |
| Data | Supabase — Postgres, Auth, Storage, Row Level Security |
| Payments | Stripe |
| AI | Anthropic SDK, behind a provider interface with a deterministic fallback |
| Testing | Node's built-in `node:test` and standalone verification scripts — no test framework |

React is pinned to 18 deliberately, so `useActionState` and other React 19 APIs are unavailable;
Server Actions are driven with `useTransition` instead.

There is **no animation library**. Framer Motion was removed in Module 28 — it was 5.4 MB for
effects that CSS keyframes and one rAF-throttled scroll listener now do.

---

## Getting started

```bash
npm install
cp .env.example .env.local        # fill in your Supabase project URL and keys
npm run db:migrate                # applies all 62 migrations in order
npm run dev
```

Open <http://localhost:3000>.

To populate a browsable shop — products, collections, reviews, blog posts, imagery:

```bash
node --env-file=.env.local scripts/seed-demo.mjs --seed
node --env-file=.env.local scripts/seed-collection.mjs nikkah --seed
node --env-file=.env.local scripts/seed-builder-images.mjs --seed
node --env-file=.env.local scripts/seed-homepage-media.mjs --seed
```

Everything the demo seeder creates is recorded in a `demo_seed_items` manifest, so
`seed-demo.mjs --clear` removes exactly those rows and provably cannot touch real business data.
See [`docs/DEMO-STORE.md`](./docs/DEMO-STORE.md).

### Environment variables

See `.env.example`. `NEXT_PUBLIC_*` values are safe in the browser. `SUPABASE_SERVICE_ROLE_KEY`
bypasses RLS entirely and is used only in server-only code and scripts — never import it into
anything that reaches the client.

---

## What is in here

**Storefront** — home, catalogue with category and occasion filters that compose, product pages,
collections, a nine-step custom builder, cart, Stripe checkout, consultations, enquiries, blog, FAQ,
customer accounts with orders, measurements, wishlist and a notification centre.

**Admin** — 58 screens covering products, collections, categories, media, orders, quotations,
payments and refunds, production and QC workflow, shipping, enquiries, appointments, customers,
reviews, campaigns, banners, segments, content pages, SEO, analytics, settings, and a team screen
for roles and permissions.

**AI assistant** — a customer-facing chatbot that answers from curated FAQs and recommends real
catalogue pieces. It runs behind a provider interface with structural guardrails: it cannot invent
a price, promise a delivery date, or claim anything about order or payment state. With no API key
configured it falls back to a deterministic provider rather than failing.

---

## Architecture in one page

**Security lives in the database, not the application.** Every table has Row Level Security, and
those policies — not route guards — are what actually stop a customer reading another customer's
order. Route guards and hidden UI are convenience; they are never the only thing standing between a
request and the data. `scripts/verify-rls.mjs` and `scripts/verify-cross-user.mjs` assert this by
signing in as real users and trying.

**Permissions are two mechanisms side by side, on purpose.** Module 26 added a
`permissions`/`role_permissions` table and a `has_permission()` function, then layered 82 new
policies alongside the existing `is_admin()` ones. Postgres PERMISSIVE policies are OR'd, so an
addition can only widen access — which made the change mathematically incapable of narrowing an
existing admin's reach. Consolidating the 179 `is_admin()` references into one mechanism would have
meant touching all of them; that risk was not worth taking, so both remain.
See [`docs/PERMISSIONS.md`](./docs/PERMISSIONS.md).

**Provider interfaces for anything external.** Shipping, email, social and AI each sit behind a
small interface with a working free-tier or mock implementation. That is why the app runs with no
courier account, no Instagram credentials and no Anthropic key.

**Images are always re-hosted on Supabase Storage.** Module 28's `remotePatterns` and Module 29's
CSP both allow the Supabase host only, so an external image URL breaks the page twice over. Branding
and builder assets carry a content hash in the filename — a fixed name with a `?v=` query string
does not reliably beat every cache, and a picture that will not change is a genuinely confusing bug.

Full reasoning in [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

---

## Testing

There is no Vitest, no Jest and no Playwright. Tests are Node's built-in `node:test` plus 41
standalone scripts that drive the real database and a real server.

```bash
npm run build && npm start                                  # most scripts need a running server
node --env-file=.env.local scripts/test-orders.mjs           # one area
node --env-file=.env.local scripts/run-suite.mjs             # everything, with per-script counts
```

`run-suite.mjs` records exact PASS/FAIL counts per script and can diff two runs. The bar for a
risky change is not "the tests still pass" — it is **the same numbers**. A script that quietly drops
from 44 checks to 40 because a setup step broke would otherwise read as a pass.

Two habits worth knowing before you add a test:

- **Test the boundary the UI actually calls.** The custom builder was broken for months while
  `test-builder-rpcs.mjs` passed the whole time, because it called the database functions directly
  and the bug was in the Zod schema every real request crosses first.
- **Clean up at the START of a run, not the end.** A crashed process never reaches its teardown.
  Scripts sweep their own leftovers before creating new fixtures, because leaked test products once
  turned up on the live storefront as filter chips.

Do not pipe `npm run build` through `head` — the SIGPIPE kills it partway and leaves a `.next`
directory that 500s on every route. Redirect to a log file instead.

See [`docs/TESTING.md`](./docs/TESTING.md).

---

## Repository layout

```text
src/
  app/
    (storefront)/    public site — home, catalogue, builder, cart, checkout, blog
    (auth)/          sign in, register, password reset, callback
    (account)/       customer dashboard — orders, measurements, wishlist, notifications
    (admin)/         58 admin screens
    api/             chat, webhooks, cron
  components/
    ui/              shadcn primitives on Base UI
    builder/         the nine-step custom builder
    storefront/      home page sections, product and collection pieces
    admin/           admin shell, sidebar, tables
  features/          Server Actions, grouped by domain
  lib/
    supabase/        browser, server and middleware clients
    auth/            session, roles, permissions
    ai/              provider interface, guardrails, query intent
    validations/     Zod schemas for every Server Action
docs/                twelve documents, one per subsystem
scripts/             62 migrations' runner, 41 test scripts, seeders, verifiers
supabase/migrations/ 62 SQL migrations, applied in filename order
```

---

## Documentation

| Document | Covers |
|---|---|
| [ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Structural decisions and the reasoning behind them |
| [PERMISSIONS.md](./docs/PERMISSIONS.md) | The nine roles, the permission matrix, RLS strategy |
| [SECURITY.md](./docs/SECURITY.md) | Module 29 audit — findings, fixes, headers, CSP |
| [TESTING.md](./docs/TESTING.md) | How the suite is organised and what each script proves |
| [PERFORMANCE-A11Y.md](./docs/PERFORMANCE-A11Y.md) | Bundle budget, contrast, keyboard and screen-reader work |
| [SEO.md](./docs/SEO.md) | Metadata, structured data, sitemaps |
| [ANALYTICS.md](./docs/ANALYTICS.md) | Event tracking and cookie consent |
| [EMAIL.md](./docs/EMAIL.md) | Provider, templates, delivery, opt-out |
| [NOTIFICATIONS.md](./docs/NOTIFICATIONS.md) | In-app centre, categories, email preferences |
| [SETTINGS.md](./docs/SETTINGS.md) | The settings registry and how to add a key |
| [AI.md](./docs/AI.md) | Guardrails, providers, occasions, recommendations |
| [DEMO-STORE.md](./docs/DEMO-STORE.md) | Seeding, the manifest, and why `--clear` is safe |

---

## Working on this project

Each module is scoped, implemented and verified independently — section 13 of the Master Build Plan
has the exact workflow. In short: inspect, agree a plan **before** writing code, implement, verify
against a production build, update the plan's status, commit.

```
Start Module 32 from the Master Build Plan.
```

Conventions this repository holds to:

- **One branch per feature.** Work does not go straight to `main`.
- **Commits explain the why.** The diff already shows what changed; the message is for the reader
  who needs to know what was tried, what was rejected, and what is still known to be wrong.
- **Known limitations get written down**, in the code and in the commit, rather than left for
  someone to rediscover.
