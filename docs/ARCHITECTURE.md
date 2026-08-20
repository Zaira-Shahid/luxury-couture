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

## Measurement System (Module 7)

- **A real gap, not a bug — the schema's own comment predicted this one too.** `measurements`
  (0004, Module 1) stores fields as free-text `field_key`/`value` rows specifically *"because
  Module 7 requires admin-configurable measurement fields — fixed columns would fight that,"* but
  nothing defined what fields actually existed. `measurement_field_definitions` (`0024`) is that
  catalog — key, label, category, description, guide image/video, required flag — same public-read/
  admin-write shape as fabrics/colours. Seeded with 13 real fields across three categories (Upper
  Body, Waist & Hips, Lengths); without this the measurement system had literally nothing to
  measure.
- No guest-access leak risk here, unlike Modules 5–6: `measurement_profiles.customer_id` is
  `not null` — there's no anonymous path to begin with, so the owner-or-admin RLS from Module 1 was
  already correct as written. Verified with `scripts/test-measurements.mjs` (11 checks: create,
  DB-level rejection of a non-positive value, cross-customer isolation via a real third account,
  admin approve, edit-after-approval resetting status to draft, correction-request setting
  `admin_notes` without touching the customer's own `notes`).
- `admin_notes` (new column on `measurement_profiles`, `0024`) is deliberately separate from the
  existing customer-facing `notes` — a single shared field would mean an admin's "please remeasure
  your waist" gets silently overwritten the next time the customer saves their own notes.
- Editing a `submitted`/`approved` profile resets its status to `draft` (in `saveProfile`,
  `features/measurements/actions.ts`) — previously-approved data that's since changed is no longer
  validly approved; this is application logic, not an RLS rule, since RLS has no concept of "was
  this value true a moment ago."
- "Images/video support" is the measurement *guide*'s per-field media (`guide_image_url`,
  `guide_video_url` as a plain embed link) — not customer-uploaded verification photos, which
  would need Module 8's Storage and isn't what "build the measurement system" asked for.
  "Attach measurement version to order" is explicitly not built here: `orders.measurement_profile_id`
  already exists as a plain FK from Module 1, but whether that should snapshot values immutably at
  order time or just reference the live profile is a real design decision for whichever of Modules
  10–12 actually creates orders — guessing at it now would be scope creep in the wrong direction.

## Inspiration Upload & Media Management (Module 8)

- **Where Supabase Storage actually gets built** — every prior module that needed a real image
  (Module 3's logo, Module 5's product/collection images, Module 6's inspiration images, Module 7's
  measurement guide) deferred to this one, using URL-paste as the interim. Two buckets, both
  `public: true` for reads: `inspiration-images` (5MB limit) and `media` (10MB limit), both with
  `allowed_mime_types` locked to real image types — `supabase/migrations/0025`.
- **Storage RLS can't replicate the id+token gate from Module 6's RPCs.** `storage.objects` policies
  only see the request's auth context (`auth.uid()`/`auth.role()`) — they have no equivalent to a
  `SECURITY DEFINER` function's explicit parameters, so there's no way to write a Storage policy that
  checks "does this upload know the right `share_token`." Both buckets have **no client-writable
  RLS policy at all** — confirmed live (`scripts/test-storage.mjs`: a guest's *valid* upload attempt
  is rejected even with a real, correctly-typed file). Every upload/delete instead goes through a
  Server Action using the service-role client (`lib/storage/upload-to-storage.ts`), which re-runs
  the exact same authorization already built — the token-gated RPCs for guests, `is_admin()` RLS on
  the `media` table for the library — *before* ever touching Storage.
- `file_size_limit`/`allowed_mime_types` are bucket-level columns Supabase Storage enforces itself,
  server-side, on every upload — verified live that an oversized or wrong-MIME-type upload is
  rejected by the bucket even via the service-role client, not just by the app's own
  `validate-file.ts` checks (which exist for immediate client-side feedback, not as the real
  boundary).
- `add_inspiration_image`/`remove_inspiration_image` (Module 6, `0022`) originally took/returned
  just a URL — the placeholder pattern from before real Storage existed. `0026` changed
  `remove_inspiration_image` to return the deleted row (so the Server Action can find its
  `storage_path` and delete the actual file, not just the DB row — Module 6's version couldn't have
  done this, since a pasted external URL was never really "owned" storage to clean up). `0027`
  added a `p_storage_path` parameter to `add_inspiration_image` instead of inserting a placeholder
  and immediately overwriting it in a second round-trip.
- Compression is client-side only (`lib/storage/compress-image.ts`, Canvas API — resize to a max
  dimension, re-encode as JPEG at reduced quality) — GIFs pass through untouched to avoid flattening
  animation, PNGs stay PNG to preserve transparency. No server-side image processing dependency;
  "where practical" for this stack means the browser does the work before the file ever leaves it.
- **Scoped out deliberately:** enquiry/order attachments — `enquiries` has no attachment column at
  all, and orders don't exist until Modules 10–12, so wiring either up now would mean inventing a
  data model nothing asked for. The admin media library (`/admin/media`) is a standalone foundation
  — it is *not* wired in as a picker into the Module 5 product/collection forms or Module 3's logo
  field in this module; that's flagged as a natural fast-follow, not silently done here.

## Enquiries, Consultations & Contact (Module 9)

- **A third instance of the same guest-scan leak**, found the same way as Modules 5 and 6: before
  proposing any code, checking whether the pattern recurred. `appointments`' SELECT policy had the
  identical `customer_id is null` clause; confirmed live that a guest's private consultation notes
  were readable in full from an unrelated anonymous session. Fixed in `0028`, same shape as `0021`.
- **The leak fix alone would have left guest booking broken**, not just secure: `appointments` had
  no `contact_name`/`contact_email`/`contact_phone` at all, so a guest appointment had no way to
  know who it belonged to. Added in the same migration as the leak fix — fixing the read leak
  without this would mean guests could still create appointments nobody could ever act on.
- **`consultation_types`** (`0029`) — the actual bookable offerings (name, description, duration),
  same public-read/admin-write shape as fabrics/embroidery_types. `appointments.type` stays the
  broad category (`consultation`/`fitting`/`other`); `consultation_type_id` is the specific,
  admin-managed thing a customer picks when booking.
- **Booking conflict checking requires reading *other* customers' slots** — something owner-or-admin
  RLS (correctly) no longer allows a regular caller to do after the `0028` fix. `bookConsultation`
  (`features/consultations/actions.ts`) uses the service-role client for exactly that narrow
  read — only the timing fields (`scheduled_at`, `duration_minutes`), never contact info — before
  the actual booking insert goes through the normal RLS-respecting path.
- **Date/time handling is deliberately naive, not timezone-converted**, because there's no
  configured store timezone anywhere in this app to convert against, and the customer's browser
  timezone isn't obviously the right one either (an in-person/atelier appointment is naturally in
  the store's local time, not the visitor's). `<input type="datetime-local">` produces a bare
  `"YYYY-MM-DDTHH:mm"` string with no offset; `lib/validations/consultations.ts` parses and
  validates it as literal text (business-hours check via string slicing, never `Date.getHours()`,
  which is timezone-dependent) and stores it with a fixed `Z` suffix so the same input always
  round-trips to the same value regardless of what timezone the server happens to run in. This was
  caught and fixed *during* implementation — an earlier version converted through `Date`/
  `toISOString()` on the client, which silently shifts the hour whenever the browser's timezone
  differs from the server's.
- **Live chat is the free-first provider abstraction pattern**, applied for the first time (the
  others — payments/notifications/shipping/AI — are still Modules 11/15/14/22, not built yet):
  `lib/chat/index.tsx` is the one mount point (`ChatWidget`, used in the storefront layout), which
  renders `components/chat/mock-chat-widget.tsx` by default — a compose form that submits straight
  into `enquiries`. Swapping in a real provider later means changing what `ChatWidget` renders, not
  touching where it's mounted.
- **Admin enquiry management stops at triage** (status, assignment) — creating the actual
  `quotations` row is explicitly Module 10's job ("admin quote workflow", per its own title
  "Cart, Checkout & **Quotation Flow**" and its stated pipeline `Enquiry → Quote → Customer
  Approval → Order"). Building quote creation here would step on that module's territory.

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
- `lib/storage/` — file validation/compression (client-safe) and the service-role
  upload/delete helper (server-only) — see Module 8 above.
- `lib/measurements/`, `lib/media/`, `lib/catalog/`, `lib/builder/`, `lib/consultations/`,
  `lib/enquiries/` — server-only read fetchers per feature area. Fetchers with no parameters
  (option/lookup lists — `get-options.ts`, `get-field-definitions.ts`, `get-products.ts`,
  `get-types.ts`, etc.) use `React.cache` like `lib/settings/`; fetchers parameterized by the
  current request (a specific id+token, the signed-in user, an admin status filter) don't, since
  there's nothing to usefully dedupe across a single call.
- `lib/chat/` — the live-chat provider abstraction (see Module 9 above); the actual widget UI lives
  in `components/chat/`, matching the project's component-vs-lib split elsewhere.
- `lib/logger.ts` — thin logging wrapper so server code never leaks raw errors to the client;
  swap the implementation for a real provider later without touching call sites.

## Forms without `useActionState`

The project pins `react`/`react-dom` to `^18` (a documented Module 0 deviation from the plan's
Next.js 14 default, now on Next.js 15) — `useActionState`/`useFormState` aren't available on
stable React 18. Forms instead use a `"use client"` wrapper calling a `"use server"` action
directly inside `useTransition`, with local `useState` for the error message. See
`src/app/(auth)/login/login-form.tsx` for the reference pattern.

## Provider abstractions

Per the Master Build Plan's free-first policy, payments, notifications, shipping, chat, and AI are
each built behind a provider interface with a mock/free implementation during development, so a
real provider can be swapped in later without changing calling code. Chat is implemented (Module 9,
`lib/chat/`) — see above. Payments, notifications, shipping, and AI land in their respective
modules (11, 15, 14, 22) — not implemented yet.

## Theming

All colors, radii, and fonts are CSS variables defined in `src/app/globals.css`'s `:root`/`.dark`
blocks and mapped into Tailwind's theme via the `@theme inline` block in the same file (Tailwind
v4 is CSS-first — there's no `tailwind.config.ts`). Components should always use the semantic
Tailwind classes (`bg-primary`, `text-muted-foreground`, etc.), never raw color values.

`--primary`/`--accent` specifically can be overridden at runtime: the root layout sets them as
inline styles on `<html>` from `getSiteSettings()` when an admin value exists, layering on top of
(not replacing) the `:root` developer defaults — see the Settings section above.
