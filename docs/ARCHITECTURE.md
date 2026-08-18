# Architecture

Quick reference for how this codebase is organized. For the full product roadmap, see
[`../Luxury-Lehenga-Master-Build-Plan.md`](../Luxury-Lehenga-Master-Build-Plan.md).

## Route groups

`src/app` is split into four route groups that map to the four audiences of the platform:

- `(storefront)` — public marketing/shopping site, wrapped in `SiteHeader`/`SiteFooter`.
- `(auth)` — sign in / sign up / password reset, centered minimal shell.
- `(account)` — logged-in customer dashboard (Module 2). Gated: any signed-out request redirects
  to `/login`.
- `(admin)` — admin dashboard (Module 2 gate; full dashboard is Module 16+). Gated: requires a
  `profiles.role` of `admin`, `staff`, or `production`.

## Auth (Module 2)

- `middleware.ts` lives at **`src/middleware.ts`**, not the project root — Next.js requires this
  when a `src` directory is used, otherwise the file is silently never invoked. (This was a
  pre-existing Module 0 bug that only surfaced once middleware needed to actually gate routes.)
  It refreshes the Supabase session cookie on every request, then redirects unauthenticated
  requests to `(account)`/`(admin)` to `/login`, and redirects non-staff roles away from
  `(admin)`.
- Route groups also re-check auth/role server-side in their own `layout.tsx`
  (`(account)`, `(admin)`) — defense in depth, since Server Components render independently of
  middleware.
- `lib/auth/session.ts` — `getAuthUser()`/`getProfile()` helpers used by pages/layouts instead of
  querying Supabase directly.
- `features/auth/actions.ts` — Server Actions for sign up/in/out and password reset, using the
  SSR client only (never the browser client for these).
- `src/app/auth/callback/` (`page.tsx` + `callback-client.tsx`) — lands signup-confirmation and
  password-reset email links. This is a **client** page, not a server route handler: Supabase's
  default email templates link through Supabase's own `/verify` endpoint, which mints the session
  itself and redirects back with `access_token`/`refresh_token` in the URL *fragment*
  (`#access_token=...`) rather than a `?code=` query param — fragments never reach the server, so
  a server route can never see them. `exchangeCodeForSession`/`code` is the right pattern for
  OAuth-provider redirects, not this project's email-link flow (no OAuth providers are used here
  anyway). `callback-client.tsx` reads the fragment client-side and calls the browser client's
  `setSession()`, which also syncs the session into cookies for the server to see on the next
  request. Confirmed against live Supabase with `scripts/test-email-flows.mjs`, which generates
  real confirmation/recovery links via the admin API and replays the exact redirect chain a
  browser would follow.
- Role changes on `profiles.role` are enforced by a trigger
  (`prevent_role_self_promotion`, `supabase/migrations/0017`/`0018`), not a column-level
  `REVOKE` — Postgres column privileges are additive on top of table-level grants, so a
  column-level `REVOKE` cannot restrict a broader table-level `GRANT UPDATE` once one exists
  (see `0014_grants.sql`). The trigger must be `SECURITY INVOKER`, not `SECURITY DEFINER` —
  inside a `SECURITY DEFINER` function, `current_user` resolves to the function's *owner*, not
  the actual caller, which silently defeated the first version of this check.

## Settings (Module 3)

- `site_settings` (`key text primary key, value jsonb`, from Module 1) is the single
  admin-configurable config store, using namespaced keys (`theme.primary`, `branding.logo_url`,
  `store.announcement_text`, `seo.default_title`, …) — see `src/lib/settings/types.ts` for the
  full shape and `get-site-settings.ts` for the key→field mapping. It has zero rows today (no
  admin editing UI exists yet — see below), so every field falls through to
  `DEFAULT_SITE_SETTINGS`, which the app must render correctly on its own.
- `getSiteSettings()` (`lib/settings/get-site-settings.ts`) fetches all rows once per request
  (`React.cache`) and merges them over the defaults into one typed object, used by the root
  layout (brand-color CSS var overrides, SEO metadata) and `SiteHeader`/`SiteFooter`
  (logo/announcement bar/social/contact/footer text).
- **Found while building this module:** `site_settings`'s only RLS policy (0012, Module 1) was
  `for all using (is_admin())` — anonymous visitors couldn't read it at all, which breaks the
  entire point of this module. Fixed with an additional public SELECT policy
  (`0019_site_settings_public_read.sql`); writes are still admin-only.
- **No admin editing UI yet** — this module builds the read/render side only. An admin can only
  change these values today via direct SQL/service-role writes; the actual settings-editing UI is
  Module 25 ("Admin Settings & Business Configuration").
- **Scoped deliberately out of this module:** admin-configurable *font family* (would need dynamic
  Google Font loading; `next/font` requires static imports at build time, so this isn't practical
  without a much bigger font-loading system — font choice stays developer-set) and logo/favicon
  *upload* (no Supabase Storage bucket exists yet; `branding.logo_url`/`favicon_url` are plain URL
  strings an admin can point at any externally-hosted image — self-serve upload is natural Module
  25 scope). The header renders the logo with a plain `<img>`, not `next/image`, since the URL is
  an arbitrary admin-supplied host that isn't in `next.config`'s remote-pattern allowlist.

## Storefront & animations (Module 4)

- `src/app/(storefront)/page.tsx` composes the homepage from
  `src/components/storefront/*` sections. `products`, `collections`, and `reviews` all have zero
  rows today (real catalog content is Module 31's job) — every data-driven section
  (`featured-collections`, `featured-products`, `testimonials`) queries the real, empty tables and
  renders `null` when empty, rather than showing an awkward empty state to real visitors. Verify
  with `scripts/test-homepage-render.mjs`, which writes temporary featured content + a real
  reviewer account via the service-role/admin API, confirms it renders, then deletes everything.
- `src/components/motion/scroll-reveal.tsx` / `page-transition.tsx` — the shared animation
  primitives (`whileInView` reveal, a light route fade-in) reused across sections instead of
  duplicating `framer-motion` boilerplate per component. Page transitions are deliberately a
  simple fade, not a full `AnimatePresence` exit/enter system, given this module's own "must
  remain performant" requirement.
- Buttons that render as links use Base UI's `render` prop (`<Button render={<Link href="..." />}>`),
  **not** Radix's `asChild` — this project's `Button` wraps `@base-ui/react/button`, which has no
  `asChild` prop at all; using it silently drops the link semantics rather than erroring.
- Admin-supplied image URLs (collection covers, product images, hero image) render via plain
  `<img>`, not `next/image`, for the same unconfigured-remote-host reason as the Module 3 logo.
- `newsletter_subscribers` (`0020`, Module 4) is a minimal capture-only table (email, source,
  subscribed_at) — Module 19 ("Marketing & Customer Retention") owns the full campaign/segment
  architecture later. **Found while verifying this module:** `subscribeToNewsletter` originally
  used `.upsert(..., { ignoreDuplicates: true })` to make re-signups idempotent, but that failed
  RLS for every anonymous caller — even brand-new emails. Root cause, confirmed against the actual
  `@supabase/postgrest-js` source: `.upsert()` always needs a `RETURNING` row internally (to report
  insert-vs-update status), *regardless of the client's return preference*, unlike plain
  `.insert()`, which truly skips `RETURNING` when `.select()` isn't chained. Since
  `newsletter_subscribers`' SELECT policy is admin-only, `RETURNING` always failed the same way
  `.insert().select()` would. Fixed by using plain `.insert()` and treating a `23505` (unique
  violation — duplicate email) as success rather than an error, since "already subscribed" is the
  correct outcome for a repeat signup anyway. **This is a general pattern, not specific to
  newsletters**: any insert-only-public/admin-only-read table (see `analytics_events`, Module 1)
  must avoid `.select()` and `.upsert()` on the anon/authenticated path for the same reason.

## Product & collection management (Module 5)

- Storefront: `/products`, `/products/[slug]`, `/collections`, `/collections/[slug]` —
  public reads via `lib/catalog/get-products.ts` / `get-collections.ts` / `get-categories.ts`,
  all request-cached (`React.cache`) like the Module 3/4 fetchers.
- **Real security bug found and fixed before building on top of this table:** `enquiries`'
  SELECT policy (0006, Module 1) was
  `using (customer_id = auth.uid() or customer_id is null or public.is_admin())`. The
  `customer_id is null` clause was meant to let a guest read back their own submission, but
  there's no way to scope "their own" for an anonymous Postgres role — it actually let **any**
  anonymous visitor read **every** guest-submitted enquiry (name, email, phone, message).
  Confirmed live before fixing: submitted a guest enquiry from one anonymous session, read it
  back in full from a completely unrelated one. Fixed in `0021` by dropping that clause; guests
  can still insert, only the submitter-if-signed-in or an admin can read a row back.
- **Admin CRUD scope, drawn explicitly against two later modules:** Module 16 ("Admin Dashboard
  Foundation") owns the polished dashboard shell/full nav — `components/admin/admin-nav.tsx` is
  deliberately minimal (just the sections that exist today) and gets wrapped/upgraded later.
  Module 17 ("Admin Product, Builder & Inventory Management") owns builder-option editing
  (fabrics/colours/embroidery as admin-editable records), builder pricing, and inventory —
  Module 5's admin pages stop at product/collection/category CRUD. Module 8 ("Inspiration
  Upload & Media Management") owns Supabase Storage; product/collection images stay URL-paste,
  same precedent as the Module 3 logo.
- The product detail page's "Customize This Piece" section shows the *global* seeded builder
  lookup options (fabrics/colours/embroidery) as a teaser linking to the Custom Builder (Module
  6) — there's no per-product variant-restriction table in the schema, and inventing one wasn't
  asked for.
- Admin CRUD actions (`features/admin-catalog/actions.ts`) use the regular SSR client, not
  `lib/supabase/admin.ts` — the existing `is_admin()` RLS policies already grant exactly the
  needed access for a real authenticated admin, so bypassing RLS with the service-role client
  would be an unnecessary privilege escalation, not a simplification. Note: the `(admin)` layout
  gate allows `admin`/`staff`/`production` roles (see Module 2), but these RLS policies allow
  writes for `role = 'admin'` only — a `staff`/`production` account could reach `/admin/products`
  but would get a generic write failure on submit. Fine-grained per-role admin permissions are
  explicitly Module 26 ("Admin Roles & Permissions") — not fixed here.
- Repeatable form data (product images, a collection's linked products) uses two different
  patterns depending on shape: a *fixed* checklist (collection→product links) uses plain
  `<input name="productIds" value={id}>` checkboxes, read server-side with
  `formData.getAll("productIds")` — no client state needed. A *dynamic, add/remove* list (product
  images) is lifted into React state in the form component, then serialized into the `FormData`
  object directly (`formData.set("images", JSON.stringify(...))`) inside the submit handler,
  rather than trying to keep a hidden `<input>` in sync.

## Custom Lehenga Builder (Module 6)

- **A second real security bug, this one self-documented by the schema.** `builder_configurations`'
  own migration comment (0003, Module 1) predicted this: *"Guest configurations are addressable
  only by their share_token in practice — discoverable via row scan here... Module 6 will tighten
  guest ownership before shipping."* Confirmed live before fixing: a guest builder draft (including
  its own `share_token`) created from one anonymous session was fully readable — via a plain
  `select *`, no token needed — from a completely unrelated anonymous session. `inspiration_images`
  had the identical pattern in its SELECT policy. Fixed in `0022`.
- **Why this fix needed RPCs, not just a tighter RLS policy.** Postgres RLS restricts *which rows a
  role can see*, but can't verify *that the caller supplied the correct secret token* — a policy
  permitting "guest rows" can't distinguish "knows the token" from "blind scan." `0022` locks
  `builder_configurations`/`inspiration_images` SELECT down to owner-or-admin only, and adds
  `SECURITY DEFINER` RPCs (`create_builder_configuration`, `get_builder_configuration`,
  `update_builder_configuration`, `claim_builder_configuration`, `add_/remove_inspiration_image`,
  plus `get_inspiration_images` added in `0023` after the first pass missed it) that require the
  exact `id` *and* `share_token` together. This is the standard, correct pattern for "shareable by
  secret link" in Postgres — verified live end-to-end with `scripts/test-builder-rpcs.mjs`,
  including that a signed-in owner falls back to normal RLS (no token needed) once they've claimed
  a design, and that an unrelated stranger still can't read it either way.
- **Price is never client-supplied, structurally, not just by convention.** None of the RPCs even
  accept a price parameter — `compute_builder_estimated_price()` always recomputes it server-side
  from the current `price_adjustment` values on the referenced option rows. `estimated_price` is
  explicitly non-authoritative either way (see the 0003 comment) — the real price is
  `quotations.quoted_price`, admin-set, created after "Request Quotation" lands an `enquiries` row
  (`type: 'builder'`) for Module 9 to act on.
- **The id+token URL *is* the save/continue/share mechanism** — no separate cookie or session
  needed. `create_builder_configuration` returns the new row; the client immediately
  `router.replace`s to `/builder/[id]?token=[share_token]`. Reloading, bookmarking, or sharing that
  URL are the same action. Signing in while on it surfaces a "claim" prompt
  (`claim_builder_configuration` — requires `auth.uid()`, only claims a still-unclaimed row).
- Scoped out, matching established precedent: inspiration images are URL-paste (Module 8 owns real
  upload); admin editing of `price_adjustment` values is Module 17's; "Request Quotation" only
  creates the `enquiries` row — admin review/response is Module 9's.

## `lib/` layering

- `lib/supabase/` — the only place Supabase clients are constructed. `client.ts` for Client
  Components, `server.ts` for Server Components/Actions, `middleware.ts` for the session-refresh
  and route-protection helper used by `src/middleware.ts`, `admin.ts` for the service-role client
  (server-only, never imported by client code).
- `lib/auth/` — server-only session/profile helpers built on top of `lib/supabase/server.ts`.
- `lib/settings/` — server-only site-settings fetch/merge layer (see above).
- `lib/validations/` — zod schemas, one file per feature area (`auth.ts`, `customers.ts`, …),
  shared between Server Actions and (where useful) client-side form checks.
- `lib/config/` — centralized, typed config (brand name, description, URL) — the fallback layer
  underneath `lib/settings/`, used directly wherever Supabase-backed settings aren't relevant.
- `lib/logger.ts` — thin logging wrapper so server code never leaks raw errors to the client;
  swap the implementation for a real provider later without touching call sites.

## Forms without `useActionState`

The project pins `react`/`react-dom` to `^18` (a documented Module 0 deviation from the plan's
Next.js 14 default, now on Next.js 15) — `useActionState`/`useFormState` aren't available on
stable React 18. Forms instead use a `"use client"` wrapper calling a `"use server"` action
directly inside `useTransition`, with local `useState` for the error message. See
`src/app/(auth)/login/login-form.tsx` for the reference pattern.

## Provider abstractions

Per the Master Build Plan's free-first policy, payments, notifications, shipping, and AI are each
built behind a provider interface with a mock/free implementation during development, so a real
provider can be swapped in later without changing calling code. These land in their respective
modules (11, 15, 14, 22) — nothing is implemented yet.

## Theming

All colors, radii, and fonts are CSS variables defined in `src/app/globals.css`'s `:root`/`.dark`
blocks and mapped into Tailwind's theme via the `@theme inline` block in the same file (Tailwind
v4 is CSS-first — there's no `tailwind.config.ts`). Components should always use the semantic
Tailwind classes (`bg-primary`, `text-muted-foreground`, etc.), never raw color values.

`--primary`/`--accent` specifically can be overridden at runtime: the root layout sets them as
inline styles on `<html>` from `getSiteSettings()` when an admin value exists, layering on top of
(not replacing) the `:root` developer defaults — see the Settings section above.
