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
- `newsletter_subscribers` (`0020`, Module 4) started as a minimal capture-only table (email,
  source, subscribed_at); Module 19 Pass 2 added `unsubscribed_at`/`unsubscribe_token` and the
  campaign/segment architecture on top — see that section below. **Found while verifying this
  module:** `subscribeToNewsletter` originally
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

## Cart, Checkout & Quotation Flow (Module 10)

- **A fourth instance of the same guest-scan leak — schema-predicted, same as Module 6's.** `carts`'
  own migration comment (0005, Module 1) said *"Module 10 (checkout) can harden this further when
  it lands."* Confirmed live before fixing: a guest cart's `session_id` itself was readable via a
  blind table scan from an unrelated anonymous session. Fixed in `0030` the same way as `0022` —
  RLS locked to owner-or-admin, `SECURITY DEFINER` RPCs (`get_or_create_cart`, `get_cart_items`,
  `add_cart_item`, `update_cart_item_quantity`, `remove_cart_item`) requiring `session_id` for the
  guest path. Unlike a builder design, a cart isn't naturally shareable, so the session id lives in
  a cookie (`lib/cart/session.ts`), not the URL.
- **A real concurrency bug, found only because cleanup verification checked for it.** After the
  first working version of `get_or_create_cart` (SELECT-then-INSERT), a routine
  "confirm nothing was left behind" check turned up two cart rows sharing one `session_id` — that
  should be impossible. Cause: `SiteHeader` (cart count) and a page like `/cart` both call
  `get_or_create_cart` with the same session id, and Next.js runs independent Server Component data
  fetches within one render in parallel — both calls could pass the "no active cart" check before
  either `INSERT` committed. Fixed in `0032` with partial unique indexes (one active cart per guest
  session, one per signed-in customer) and `INSERT ... ON CONFLICT ... DO UPDATE`, verified by
  firing 10 genuinely concurrent RPC calls with the same session id and confirming exactly one row
  results.
- **Server Components can't set cookies — a bug caught before it ever ran in production.** The
  first version of the cart-session cookie helper called `cookies().set()` from `getCart()`, which
  is invoked by Server Component pages (`/cart`, `/checkout`, `SiteHeader`) — Next.js only allows
  cookie mutation in Server Actions/Route Handlers, so a first-time visitor's very first request
  would have thrown. Fixed with a read-only `peekCartSessionId()` for Server Component contexts,
  and the cookie itself is now guaranteed to exist *before* any page renders by setting it in
  `src/middleware.ts` (the one place that can) rather than lazily on first read.
- **A tampered client-supplied price never reaches a real order — structurally, not by review.**
  `cart_items.unit_price_snapshot` is client-writable by its own original column comment ("NOT a
  source of truth"); `placeOrder`/`acceptQuotation` never read it — every order line re-fetches the
  real price from `products.base_price` / `builder_configurations.estimated_price` /
  `quotations.quoted_price` at order-creation time. Verified live: added a cart item with a
  snapshot price of `1` against a real `250` product, confirmed the persisted `order_items.unit_price`
  and `orders.subtotal` reflect `250`, not `1`.
- **`orders`/`order_items`/`payments` are admin/service-role-write-only by RLS**, per Module 1's own
  design intent ("all writes happen server-side once prices/quantities/status have been
  validated"). `placeOrder` therefore uses the service-role client for the actual insert — the
  *validation* (cart ownership, address/measurement-profile ownership, real prices) all happens
  first against the regular RLS-respecting client. `acceptQuotation` needs the same elevation for a
  different reason: `quotations` is admin-write-only with no separate customer-writable
  "acceptance" column modeled, so accepting one is a legitimate, narrow use of the service-role
  client — scoped to exactly that one enforced transition (owner check + `status = 'sent'` guard
  against a double-accept race), not a general bypass.
- **A checkout redirect quirk, initially misdiagnosed, corrected in a dedicated follow-up pass.**
  `/checkout`'s own `redirect()` for a signed-out visitor produced a `200` with a client-side/
  meta-refresh redirect instead of a clean `307`. First diagnosis blamed `PageTransition` (Module
  4's client component wrapping every `(storefront)` page) specifically. That was wrong: isolated
  testing (a bare route with no client wrapper at all, `notFound()` moved into a layout instead of
  a page, `export const dynamic = "force-dynamic"`) showed the **same** 200-status behavior in
  every case — this is a general Next.js 15 App Router characteristic for *any* `notFound()`/
  `redirect()` thrown during page/layout rendering, not something specific to client-component
  boundaries. Re-checking the "working" baseline confirmed `/account`'s clean 307 was never the
  layout's own `redirect()` proving anything — it's a genuinely separate, **middleware**-level
  redirect (a 22-byte body, not a rendered page) that catches unauthenticated requests before any
  React rendering starts; the layout's `redirect()` is a defense-in-depth fallback that had simply
  never been exercised by any prior test. `/checkout` is now gated in middleware the same way.
  There's no data-leak risk from any of this either way — RLS already governs what data is ever
  included in a response; only the raw HTTP status code was ever wrong.
  **Also fixed, in the same follow-up pass** (this affects all 11 `notFound()` call sites
  site-wide, not just storefront ones — comprehensively fixing all of them would mean coupling
  middleware to every domain entity, so scope was deliberately limited to the 3 *public* pages,
  where the status code actually matters for SEO/crawlers; `(account)`/`(admin)` pages sit behind
  auth and aren't crawled): `products/[slug]`, `collections/[slug]`, and
  `checkout/confirmed/[orderNumber]` now get a genuine `404` via existence checks added directly in
  `src/lib/supabase/middleware.ts`, returning a hand-built HTML response (inline styles — Edge
  middleware can't reference the app's content-hashed compiled CSS or render `not-found.tsx`
  directly) rather than relying on the page's own `notFound()`. The order-confirmation check
  reuses the same RLS-scoped query as the page (owner-or-admin), so a wrong owner and a genuinely
  nonexistent order number produce the identical outcome — no enumeration signal either way. The
  page-level `notFound()` calls stay in place as defense in depth. Verified against a real
  production build: invalid slugs/order numbers now 404, valid ones and the listing pages
  (`/products`, `/collections`) still 200.
- **A "gap" in my own plan that turned out not to exist.** I initially planned a migration to relax
  `order_items`' exactly-one-of-`product_id`/`builder_configuration_id` constraint, believing it
  matched `cart_items`' real constraint of the same shape. Checking `pg_constraint` directly before
  writing that migration showed `order_items` never had any such constraint — both columns are
  simply nullable with no exclusivity check. No fix was needed; the planned `0031` migration was
  deleted before being applied.

## Payment System (Module 11)

- **Provider abstraction, free-first, same shape as chat (Module 9).** `lib/payments/provider.ts`
  defines one `PaymentProvider` interface (`createCheckoutSession`, `refund`); `StripeProvider` is
  the real implementation, `ManualProvider` exists only for interface symmetry (manual/offline
  payments are confirmed directly by an admin action, never routed through a provider call).
  `isStripeConfigured()` (`!!process.env.STRIPE_SECRET_KEY`) gates whether the storefront shows a
  "Pay Now" button at all — unset, customers see "we'll contact you to arrange payment" instead, so
  the app runs correctly with zero payment-provider cost/setup.
- **Stripe Checkout Sessions, not Elements/Payment Element.** Deliberately redirect-based
  (`mode: "payment"`) so no `@stripe/stripe-js` is needed client-side at all; Checkout automatically
  surfaces Apple Pay/Google Pay when the browser/device supports them, satisfying that requirement
  without building anything extra.
- **The webhook, not the client redirect, is the only source of truth for payment status** — per
  "never trust client-submitted status" (Master Build Plan §11). `initiatePayment`'s
  `success_url`/`cancel_url` only ever show a "confirming your payment now" message, never claim
  success directly; `/api/webhooks/stripe` verifies every event's signature against
  `STRIPE_WEBHOOK_SECRET` before trusting anything in it, and only a verified `checkout.session.completed`
  event flips a `payments` row to `succeeded`.
- **Raw body required for signature verification.** `request.text()`, never `request.json()` first —
  parsing the body as JSON would consume the stream and break `stripe.webhooks.constructEvent`.
- **`orders.deposit_amount`/`balance_due_amount` weren't being set at order-creation time — a real
  gap, caught by a self-initiated consistency check, not a review comment.** Both `placeOrder`
  (cart checkout) and `acceptQuotation` insert a new `orders` row, but neither originally set
  `balance_due_amount` (left at its column default of `0`, even though the full amount was actually
  owed). Fixed in both: `placeOrder` always sets `balance_due_amount: subtotal` (it has no
  deposit concept — one `full` payment per cart order); `acceptQuotation` sets
  `deposit_amount`/`balance_due_amount` from the quotation's own `deposit_amount`, and now branches
  the payment it creates into a `deposit` (if the admin set one) versus a `full` payment for the
  whole quoted price — a deposit-first order gets its balance collected later via the admin's
  "create additional payment" action.
- **Idempotent order-total recomputation, not incremental — a bug caught before it ever ran.**
  `updateOrderAfterPayment` (in the webhook route) recomputes `deposit_paid_amount` and
  `balance_due_amount` from the *complete* set of an order's currently-`succeeded` payments every
  time it runs, rather than adding the payment just processed. An incremental version would
  double-count on a retried/duplicate webhook delivery — Stripe explicitly does not guarantee
  exactly-once delivery. Verified live: the same signed `checkout.session.completed` event replayed
  a second time leaves `balance_due_amount` unchanged (still correctly `0`), while still logging a
  second `payment_transactions` row (that table is a raw audit log, deliberately not deduplicated).
- **`orders`/`order_items`/`payments` stay admin/service-role-write-only by RLS (Module 1's original
  design)** — `initiatePayment`, `markPaymentPaidManually`, `refundPayment`, and
  `createAdditionalPayment` all validate ownership/state against the regular RLS-respecting client
  first, then use the service-role client (webhook route) or rely on the caller already being
  admin-gated (admin actions, behind `/admin`'s middleware auth check) for the actual write.
- **Verified live**, via `scripts/test-payments.mjs` (two real customers + a real admin, service-role
  and RLS-respecting clients side by side, cleaned up after) and a live `stripe listen --forward-to
  localhost:3000/api/webhooks/stripe` tunnel against the real Stripe test-mode API:
  - Cross-customer payment visibility: a second customer's blind scan of `payments` returns nothing;
    the owner sees their own row.
  - Manual payment flow: admin mark-paid updates status/`paid_at`; the customer-facing query
    reflects it immediately.
  - A real Stripe Checkout Session created against the live test-mode API returns a genuine hosted
    `url` and session id.
  - The webhook route: accepts a validly-signed `checkout.session.completed` (200), updates the
    `payments` row, recomputes and bumps the order to `confirmed`, logs `payment_transactions`;
    rejects an invalid signature (400); a duplicate delivery of the same event stays idempotent on
    `balance_due_amount` while still logging its own audit row; `charge.refunded` is accepted and
    handled without error.
  - Separately, `stripe trigger checkout.session.completed` was run through the actual running
    `stripe listen` tunnel (a **real**, Stripe-server-signed event, not a self-signed test payload)
    and confirmed to reach the live route and return 200 — validating the configured webhook secret
    genuinely matches what Stripe issues, not just that the verification code is internally
    consistent.
  - **Not tested live**: a customer completing a real Stripe Checkout Session in a browser (would
    require browser automation, not available in this environment) and a real Stripe `refund()`
    call against a genuinely-completed PaymentIntent (Checkout Sessions only get a payable
    PaymentIntent once a real payment method is confirmed via Stripe's hosted page). The Stripe
    Checkout Session creation call, the webhook's signature verification and DB-side processing,
    and the manual-provider refund path are all verified live; the Stripe-side `refund()` call
    itself is verified by code review only (same `stripe.refunds.create` shape Stripe's own docs
    use), not by a live successful refund.

## Order Management (Module 12)

- **Scope boundary vs. Modules 13/14.** Module 13 (Production Workflow) owns the actual 12-stage
  pipeline UI and status-advancing logic; Module 14 (Shipping & Tracking) owns the shipping
  abstraction and courier tracking. `production_orders`/`shipping_orders` (schema from Module 1's
  `0008`) already existed with RLS ready but nothing writing to them — Module 12 reads them
  defensively (a customer/admin order detail page just shows "no production/shipping info yet" if
  neither row exists) and adds exactly one write: the "production handoff" bullet, creating the
  initial `production_orders` row at its default `order_confirmed` status. It does not add any
  status-advancing controls beyond that — those are Module 13's.
- **`order_notes` is a separate admin-only table, not an `orders.admin_notes` column — a
  deliberate structural choice, not a naming preference.** `orders`' own SELECT policy already
  grants the owning customer full-row access (`customer_id = auth.uid() or is_admin()`); Postgres
  RLS is row-level, not column-level, so a plain `admin_notes` column would be readable by *any*
  query that customer's own session could construct, not just whatever the app's UI happens to
  select. (This is distinct from `measurement_profiles.admin_notes`, which is deliberately
  customer-visible — a "correction requested" message — not a private note; there was no existing
  precedent in this codebase for a genuinely private per-order note before this.) `order_notes`
  instead gets its own table with `for all using (is_admin()) with check (is_admin())`, the same
  shape as `payment_transactions` — this closes the leak off structurally rather than relying on
  the app never selecting the column. Verified live: the order's own owner (not just an unrelated
  customer) gets zero rows back from `order_notes` under both a filtered and an unfiltered scan.
- **`order_status_history` mirrors `production_status_history`'s exact shape** (status, note,
  changed_by, created_at) and is what the customer-facing "order timeline" bullet is built from.
  `updateOrderStatus` writes one row per status change and a `notifications` row in the same
  action, so a single admin action satisfies three plan bullets at once: "status changes" (admin),
  "order timeline" (customer), and "notifications" (customer) — without needing Module 15's full
  multi-channel notification engine.
- **`notifications` (schema from Module 1's `0009`) was real and unused before this module** — RLS
  already supported owner-or-admin read, owner-or-admin update (for `read_at`), admin-only insert.
  Module 12 is the first thing to actually write to it: `updateOrderStatus` (status-change
  notifications) and `sendCustomerMessage` (the "customer communication" bullet — a free-text
  in-app message tied to an order). Both use `channel: "in_app"` only; email/WhatsApp/SMS senders
  and event-triggered templates are explicitly Module 15's "Notifications & Automation Engine".
  `/account/notifications` (a `ComingSoon` stub since Module 2) is now real: list + per-item
  mark-as-read, RLS-scoped to the signed-in customer.
- **Admin write actions rely on RLS (`is_admin()`), not an in-action role re-check** — same
  established pattern as `markPaymentPaidManually`/`updateEnquiryStatus`: `/admin` is already
  gated by middleware + layout before any of these actions can be invoked from the UI, and the
  regular RLS-respecting client enforces the real write authorization underneath. Unrestricted
  status transitions (any of the 7 `orders.status` values, at any time) — a real state machine
  (blocking e.g. `cancelled` → `pending`) is explicitly deferred to Module 13, per the user's own
  call on this tradeoff.
- **Verified live** via `scripts/test-orders.mjs` (two customers + an admin, cleaned up after):
  cross-customer order/status-history/notification visibility: 0 rows both filtered and via a
  blind unfiltered scan; a status change produces both a history row and a notification, each
  correctly RLS-scoped to the owner; `order_notes` is unreachable by the order's own owner (not
  just a stranger) under any query shape, while admin can read/write it; `sendToProduction`'s
  idempotency is backed structurally (a second insert attempt is rejected by
  `production_orders.order_id`'s own unique constraint, not just an app-level pre-check);
  notification mark-as-read is owner-scoped (a non-owner's update affects 0 rows, not an error —
  RLS silently filters rather than rejecting, so this was checked by asserting 0 rows affected and
  the notification still unread afterward, not by expecting a thrown error).

## Base UI Input: stale `defaultValue` after an in-place save

- **Root cause, not a per-form bug.** `Input` (`src/components/ui/input.tsx`) wraps
  `@base-ui/react/input`, which — unlike a plain `<input>` — actively watches `defaultValue` on an
  uncontrolled field and warns if that prop's *value* changes after the field's first render
  ("changing the default value state of an uncontrolled FieldControl after being initialized").
  Five edit-in-place forms feed `Input`'s `defaultValue` straight from server-fetched data
  (`product-form`, `collection-form`, `category-form`, `profile-form`, `measurement-form`), and
  each one's update Server Action calls `revalidatePath` on the *same* page **without a redirect**
  — a deliberate UX choice (stay on the page, show a success toast) established back in earlier
  modules. Next.js's Server Action refresh then pushes the freshly-saved (now-different) record
  into the still-mounted form, and Base UI catches the mismatch.
- **Fix: remount, not "make everything controlled."** Each of the five call sites now passes
  `key={`${id}-${updated_at}`}` to its form component (e.g. `<ProductForm key={...} .../>` in
  `/admin/products/[id]/edit/page.tsx`). Since `updated_at` only changes when a save actually
  succeeds, this is the React-canonical "reset state via key" pattern — the form gets a fresh
  mount with the new data as its genuine initial `defaultValue`, rather than Base UI seeing an
  already-initialized field's default change out from under it. Converting these forms to fully
  controlled inputs was considered and rejected — a much bigger behavioral change across five
  multi-field forms, for a problem a one-line `key` already solves cleanly.
- **Checked, not assumed, that the pattern doesn't repeat elsewhere.** Only `Input`, `Button`, and
  `Separator` wrap Base UI primitives in this codebase (grepped `@base-ui/react` imports directly);
  `Textarea` and native `<select>`/`<input type="radio|checkbox">` don't, so they can't produce
  this specific warning even though a couple of them (e.g. Module 12/13's native status-select
  dropdowns) have the same *conceptual* staleness shape — out of scope since they don't warn.
  Every other `Input` usage in the codebase (20 files total) was checked individually: the rest are
  either create-only forms that reset or unmount on success (enquiry/consultation/checkout/address
  forms), or fed by props that don't change post-mount. `media-library.tsx`'s per-item alt-text
  `Input` looked similar but isn't: it seeds `useState(initialMedia)` once and never syncs it back
  from a revalidated prop, so the `defaultValue` it passes never actually changes across renders —
  a different (minor, unrelated) staleness bug, not this one, and left alone.
- Module 13's own new `DetailsForm` (`/admin/production/[id]/details-form.tsx`) has the identical
  shape (`Input` + `defaultValue` fed by `production_orders`, its update action revalidates the
  same page) — given the `key` fix at the point of writing it, rather than needing a follow-up
  patch.

## Production Workflow (Module 13)

- **A necessary, narrow RBAC change — not Module 26.** `is_admin()` was, until this module, the
  *only* RLS write-gate anywhere in the schema (`role = 'admin'` exclusively) — `staff`/`production`
  accounts could already reach every `/admin` page via middleware+layout, but every write silently
  failed under RLS, and reads of `orders`/`production_orders` failed outright for anyone but an
  admin or the order's own customer. Module 13's own line, *"Production staff should have limited
  access,"* needed real RLS to back it, not just UI — that's a `0034` migration, not Module 26's
  full per-role permission system (Super Admin/Sales/QC/Finance/Marketing, explicit per-role grants
  — a much bigger, still-untouched piece of work). Scoped to exactly `role = 'production'`
  (`staff` was explicitly excluded on request): a new `is_production_staff()` helper, additive
  select/insert/update policies on `production_orders`/`production_status_history`, and — the part
  that actually makes the pipeline usable — additive **read** access to `orders`/`order_items`,
  but only for orders that already have a `production_orders` row (i.e., only what's actually been
  handed to them, not the full order book, not orders still in sales negotiation). One further
  additive policy lets that role insert into `notifications` (Module 12's pattern:
  `advanceProductionStatus` notifies the customer the same way `updateOrderStatus` does).
- **A real infinite-recursion bug, caught by the verify-then-cleanup discipline itself before
  commit.** The first version of the new `orders` SELECT policy checked `production_orders` via a
  raw `exists (select ... from production_orders ...)` subquery. But `production_orders`' own
  pre-existing (Module 1, `0008`) SELECT policy checks *back* into `orders`
  (`o.customer_id = auth.uid()`) to let the owning customer read it — so evaluating either policy
  re-triggered the other: `orders` → `production_orders` → `orders` → ... Postgres surfaced this
  immediately and unambiguously (`42P17`, "infinite recursion detected in policy for relation
  orders") the moment the verification script tried a plain admin read of any order — which would
  have broken `/admin/orders` entirely for every admin, not just production staff, had it shipped.
  Fixed in `0036` the same way `is_admin()` itself avoids recursing into `profiles`: route the
  existence check through a `security definer` function
  (`order_has_production_handoff(order_id)`) whose internal query runs outside RLS entirely, so it
  can never re-trigger `production_orders`' policies. Re-ran both Module 11's and Module 12's own
  verification scripts afterward as a regression check — all still pass.
- **No auto-sync between `production_orders.current_status` and `orders.status`** — a deliberate
  choice, same reasoning as Module 12's "unrestricted status transitions": the two stay
  independent, admin-driven fields. Advancing a production stage never silently changes the
  order's top-level status behind anyone's back.
- **The customer's order timeline (Module 12) now merges two history tables**, not just one:
  `order_status_history` and `production_status_history`, sorted together by `created_at`. Both
  were already independently RLS-readable by the order's owner; this is a small extension of an
  existing card, not new access.
- **Verified live** via `scripts/test-production.mjs` (a customer, an admin, and a `production`-role
  account, cleaned up after): production staff can read a handed-off order and its items but
  **not** an order that hasn't been sent to production (confirmed both filtered and via an
  unfiltered blind scan — 1 row back, not 2); can advance `current_status`, insert history, and
  insert a customer notification, all landing correctly and visible to the customer; cannot read
  any `payments`, change `orders.status`, or write `order_notes` — confirming "limited," not just
  "different." A plain `admin` account retains full access throughout (both orders, direct status
  advancement). Re-ran `scripts/test-orders.mjs` and `scripts/test-payments.mjs` afterward with no
  regressions.

## Shipping & Tracking (Module 14)

- **Free-first provider abstraction, same shape as payments (Module 11) and chat (Module 9).**
  `lib/shipping/provider.ts` defines one `ShippingProvider` interface (`createShipment`);
  `MockShippingProvider` is the only implementation — a flat-by-destination rate rule (UK vs.
  international), not a real rates engine, matching the plan's own "Development: mock shipping
  rates, mock tracking" scope. A real courier (Royal Mail, DHL, a rates API) is explicitly **not
  implemented** — architecturally supported only, same deferral as Module 11's PayPal decision (no
  real courier credentials exist to integrate against).
- **`shipping_orders.shipping_cost` stays informational, never charged to the customer.** Modules
  10/11 already finalized `orders.total_amount` at order-creation time with no shipping line item,
  and payments are derived strictly from that total. Retrofitting checkout to add a shipping charge
  after the fact would touch already-verified invariants for a module whose actual bullets are
  about rates/tracking mechanics, not billing — the mock cost is recorded for admin visibility
  only, shown on `/admin/shipping/[id]` labeled explicitly as "not charged to customer."
- **No RBAC changes this module** — unlike Module 13, no shipping-specific staff role exists in the
  plan or the `UserRole` enum, so `shipping_orders`/`shipping_events` stay `is_admin()`-only via
  their original Module 1 (`0008`) policies. No new migration was needed at all for this module —
  every column the build needed (`courier`, `tracking_number`, `status`, `shipping_cost`,
  `shipped_at`, `delivered_at`, `shipping_events.description`/`occurred_at`) already existed.
- **No dedicated "tracking page" route** — extending `/account/orders/[id]` instead, the same move
  Module 13 made for production: `shipping_events` is now a third source merged into that page's
  combined timeline (alongside `order_status_history` and `production_status_history`, all sorted
  together by timestamp), and the existing "Production & Shipping" summary card now shows the real
  courier and tracking number instead of placeholder nulls.
- **Shipment creation is independent of `production_orders`.** A plain product order (no custom
  `builder_configuration` items) never gets a `production_orders` row at all, but still needs
  shipping — `/admin/orders/[id]`'s new "Create Shipment" card is gated only on `!shipping`, not on
  production state, mirroring the same idempotent-creation shape as Module 12's "Send to
  Production" (existence-checked first, backed by `shipping_orders.order_id`'s own unique
  constraint as the structural backstop either way).
- **`shipped_at`/`delivered_at` are set automatically on the relevant transitions**, not left for
  the admin to fill in by hand: `advanceShippingStatus` sets `shipped_at` the first time status
  leaves `pending`, and `delivered_at` when status first reaches `delivered` — verified live via
  both transitions in sequence, confirming `shipped_at` isn't reset by a later `delivered_at` set.
- **The `DetailsForm` (courier/tracking number, `/admin/shipping/[id]/details-form.tsx`) applied
  the Base UI `Input` remount-key fix from the moment it was written** (`key={`${shipping.id}-${shipping.updated_at}`}`
  at the page level) — it has the identical shape (`Input` + `defaultValue` from server data, its
  update action revalidates the same page) as the five forms that needed a follow-up patch for this
  exact issue earlier in the project.
- **Verified live** via `scripts/test-shipping.mjs` (two customers + an admin, cleaned up after):
  create-shipment idempotency backed by the real unique constraint; cross-customer RLS on
  `shipping_orders` (filtered and via an unfiltered blind scan); a customer can neither change
  shipping status nor insert a tracking event; a status advance produces a customer-visible
  tracking event and notification, with `shipped_at`/`delivered_at` set correctly on their
  respective transitions. Re-ran Modules 12's and 13's own verification scripts afterward — both
  still pass, confirming this module's (much smaller, no-new-RLS) changes didn't regress either.

## Notifications & Automation Engine (Module 15)

- **This module is the debt Modules 12–14 explicitly flagged coming due.** Each of them already
  wrote directly to `notifications` (schema from Module 1's `0009`, unused until Module 12) with
  its own ad hoc `title`/`body` string, each noting "ahead of Module 15's full engine." Module 15
  is that consolidation — `updateOrderStatus`, `sendCustomerMessage`, `sendToProduction`,
  `advanceProductionStatus`, `advanceShippingStatus` all now go through one real architecture
  instead of their own inline inserts — plus the 8 events the plan lists that had no trigger point
  at all before this module (deposit paid, balance due, quote created, quote approved, production
  started, QC complete, shipped, review request, account created).
- **`lib/notifications/notify.ts`** — one `notify(supabase, params)` function, taking an
  already-instantiated Supabase client rather than creating its own. Necessary because call sites
  span three genuinely different contexts: the regular RLS-respecting client in Server Actions, the
  service-role client inside the Stripe webhook route (no user session exists there at all), and —
  the one exception that never calls this function — the `handle_new_user()` DB trigger for
  "account created," which can't call app-level TS code and duplicates its one welcome message
  directly in SQL (`0037`). Inserts the in-app `notifications` row only when `profileId` is given
  (a guest enquiry has no account to attach one to), and separately "sends" via mock email/WhatsApp
  whenever that contact info is available regardless — so a guest still gets a (mocked)
  confirmation even with no in-app inbox to show it in. Returns `{ inAppSuccess }` rather than
  `void`, because one call site (`sendCustomerMessage`) needs to surface a real failure to the
  admin — sending *is* that action's entire purpose, unlike the other call sites where the
  notification is a secondary effect of an action that already succeeded on its own terms.
- **`lib/notifications/mock-channels.ts`** — `sendMockEmail`/`sendMockWhatsApp`, both just
  `logger.info` calls clearly tagged `[mock email]`/`[mock whatsapp]`. Per the plan's own "for
  development, use mock/local notification providers" — no real provider credentials exist to
  integrate against, same deferral shape as Modules 11/14's PayPal/courier decisions. Verified
  live: a real Stripe webhook delivery (through the actual signature-verified route, not a
  self-signed test payload) produced a real `[mock email]` log line with the correct order number
  and amount. SMS stays entirely unbuilt — "SMS later," literally, in the plan.
- **`lib/notifications/templates.ts`** — one small pure function per event
  (`orderConfirmedTemplate`, `depositPaidTemplate`, `shippedTemplate`, etc.), each returning
  `{ type, title, body }`. This is "create notification templates" made concrete — plain
  functions, not a DB-editable template table (not asked for, and notification preferences/UI
  polish are explicitly Module 27's — "Customer Notification Center" — job, not this module's).
  Several events reuse one generic fallback template (`orderStatusChangedTemplate`,
  `productionStatusChangedTemplate`, `shippingStatusChangedTemplate`) for the statuses that don't
  get their own dedicated wording (e.g. `pending`, `cutting`), while specific statuses branch to a
  dedicated template at the call site (`confirmed` → `orderConfirmedTemplate`, `quality_check` →
  `qcCompleteTemplate`, the first non-`pending` shipping transition → `shippedTemplate`, `delivered`
  → `deliveredTemplate` **and** a separate `reviewRequestTemplate` fired immediately after — no
  scheduler exists anywhere in this stack to delay the review prompt, an explicit, approved
  simplification).
- **One small additive RLS policy (`0037`), no recursion risk.** `notifications` INSERT was
  previously admin/production-staff-only (`0009`, `0035`) — two events (enquiry received, quote
  approved) are customer-initiated with no admin in the loop, so the customer's own session needs
  to insert a notification about *themselves*. Added `with check (profile_id = auth.uid())`, a
  direct column comparison with no subquery into another table — structurally can't reproduce
  Module 13's `0034` recursion bug. Every admin-initiated event still relies entirely on the
  existing `is_admin()`/`is_production_staff()` policies; the webhook route uses the service-role
  client and bypasses RLS regardless.
- **Guest-safe by construction, not by special-casing.** `enquiries.customer_id` is nullable (the
  same guest-submission design already established for enquiries/appointments/carts) — all three
  enquiry-submission sites (`submitProductEnquiry`, `submitEnquiry`, the builder's
  `requestQuotation`) pass `profileId: user?.id ?? null` straight through to `notify()`, which
  simply skips the in-app branch when it's null and falls back to the guest's own `contactEmail`/
  `contactPhone` for the mock channels — no separate guest code path was needed.
- **Verified live** via `scripts/test-notifications.mjs` (cleaned up after): the `handle_new_user()`
  trigger auto-creates a welcome notification on signup; the new self-insert policy lets a customer
  notify themselves but not another profile; a guest enquiry correctly has no `profile_id` to
  attach an in-app row to; each refactored/newly-wired call site's dedicated template branch
  produces the right `type` and order-number-bearing body (order confirmed, QC complete, shipped
  with courier+tracking, delivered plus a separate review-request row, deposit paid, balance due,
  quote created for a guest enquiry, quote approved via self-insert). Re-ran Modules 11's, 12's,
  13's, and 14's own verification scripts afterward — all still pass, including a real end-to-end
  webhook delivery through the live route confirming the mock email fired correctly.

## Admin Dashboard Foundation (Module 16)

- **Scope checked against the plan's own later modules, not guessed.** The plan's Module 16 nav
  list has ~20 items, but most are explicitly owned by a dedicated future module: Builder (admin
  CRUD) and Inventory → Module 17; Reviews → Module 18; Marketing → Module 19; Content and SEO →
  Module 20; Analytics (as a full section) → Module 21; Settings → Module 25. Building any of those
  now would mean redoing them when their real module lands — each gets a `ComingSoon` placeholder
  (the same component used throughout this project, e.g. `/account/orders` before Module 12) naming
  the module that owns it, not new functionality. **Customers and Quotations have no owning module
  and no schema gap** — both are plain reads over data that already exists (`profiles`, `orders`,
  `quotations`) — so both got real pages this module, per explicit approval.
- **Sidebar shell replaces the old flat top nav**, using the `--sidebar-*` design tokens that had
  sat unused in `globals.css` since the design system was set up — clearly pre-planned for exactly
  this. `components/admin/admin-nav-items.ts` is the single source of truth for the nav (grouped:
  Overview/Sales/Operations/Catalog/Growth/System — visual grouping only, no items added or removed
  beyond what the scope table above decided), shared between the desktop `AdminSidebar` (fixed
  column) and a mobile slide-in panel (`AdminMobileNav` — plain `useState` toggle, no new
  dependency; the storefront itself has no mobile nav to mirror, since `SiteHeader` just hides its
  nav below the `sm` breakpoint rather than offering a drawer). `admin-nav.tsx` (the old flat bar)
  was deleted, not kept alongside the new shell.
- **`lib/admin/get-dashboard-stats.ts`** runs 13 aggregate queries in parallel (`Promise.all`),
  using `{ count: "exact", head: true }` for pure counts rather than fetching row data — this
  project's first use of that Supabase JS option, appropriate here since a dashboard querying 8+
  aggregates has no reason to pull full rows over the wire. All of it rides the existing
  `is_admin()` RLS path on each underlying table (`payments`, `orders`, `profiles`, `enquiries`,
  `production_orders`, `shipping_orders`, `reviews`) — no new RLS needed, no new leak class
  possible. "Analytics" on the dashboard is a small built-in this-week-vs-last-week order
  comparison, not a charting library or new dependency — the real Analytics *section* (its own nav
  item) stays `ComingSoon`, owned by Module 21.
- **Customer email isn't in `profiles`** (it lives in `auth.users`) — `getAdminCustomerDetail`
  fetches it via `auth.admin.getUserById`, the service-role client, on the **detail** page only,
  not the list. Deliberate: listing customers doesn't need every email fetched up front (would mean
  either an N+1 or a `listUsers()` call unrelated to what the list actually displays), and this
  keeps the privileged lookup scoped to exactly the one row being viewed.
- **Verified live**, and for the first time in this project, via a genuinely authenticated HTTP
  session rather than only DB-mirrored logic: `scripts/test-admin-dashboard.mjs` hand-constructs
  the real `@supabase/ssr` session cookie format (`sb-<project-ref>-auth-token`,
  `base64-` + base64url-encoded session JSON — read directly from `node_modules/@supabase/ssr`'s
  own cookie-parsing source rather than assumed) and fetches all 22 admin routes (the ~20 the plan
  lists, plus `Categories`/`Media`, which are real working pages not in the plan's literal list but
  kept rather than dropped) against a live `next dev` server — every one returned a genuine 200,
  with zero server-side errors or warnings in the dev server log. Also confirmed an unauthenticated
  request to `/admin` still redirects (not a 500), and RLS-checked that a plain customer account
  gets nothing back from `profiles`/`quotations` while admin sees everything.

## Admin Product, Builder & Inventory Management (Module 17)

- **Builder options already had complete admin RLS from Module 1** — `fabrics`, `embroidery_types`,
  `colours`, `sleeve_styles`, `necklines`, `dupatta_options` all got full insert/update/delete
  policies generated identically via a `do $$ loop` in `0003`, purely because nothing had built the
  admin UI for them yet. This module is UI + Server Actions only for these six tables — **no new
  migration** for them, confirmed directly against the migration files rather than assumed.
- **One generic CRUD surface for all six, not six near-duplicates.** They share an identical shape
  (`colours` swaps `description` for `hex_value`) and identical RLS for exactly that reason —
  `/admin/builder/[table]` (list/new/edit) is one set of components parameterized by table.
  `table` is validated against the literal 6-value `BuilderOptionTable` union
  (`isBuilderOptionTable`, checked before it ever reaches `.from()`) — an invalid segment hits
  `notFound()` and never touches the database. Verified live: the invalid-table case renders the
  real not-found page rather than throwing, confirming the guard actually runs before any query.
- **"Builder pricing" is editing `price_adjustment` on these same six tables, not a separate
  engine.** `compute_builder_estimated_price` (`0022`) is a `stable` Postgres function that reads
  each option's `price_adjustment` live on every call — there's no cached/derived price to
  recalculate. Verified directly: calling the RPC before and after updating a fabric's
  `price_adjustment` (50 → 75) shows the change take effect immediately, with no intermediate step
  of any kind.
- **Product images: reused Module 8's media library as a picker, no new Storage bucket.**
  `docs/ARCHITECTURE.md`'s own Module 5 section had flagged this exact gap as Module 17's natural
  fast-follow. `components/admin/media-picker.tsx` browses the existing `media` table (upload
  inline via the existing `uploadMedia` action, or pick an already-uploaded image) and fills in
  `ProductForm`'s existing `url`/`altText` row state — no shape change to `ImageRow`, manual
  URL-paste stays available alongside it, purely additive.
- **Inventory: one generic table, not three.** `inventory_items` (`0038`) covers fabrics, generic
  materials, and embroidery materials via a `category` column, matching the plan's own "designed to
  support" wording rather than three separate tables. `fabric_id` links stock to an actual
  customer-facing fabric only when `category = 'fabric'` — generic materials and embroidery
  supplies (thread, sequins, lining) have no natural FK to any existing table, since they're raw
  supplies, not customer-facing style choices like `embroidery_types`. Admin-only RLS (`for all
  using (is_admin())`), same shape as `order_notes`/`payment_transactions` — no staff/production
  carve-out, since that gap is explicitly deferred to Module 26 project-wide, not something to
  re-open here.
- **`reserved_quantity` is admin-edited only, by explicit approval** — no bill-of-materials linking
  products/builder configurations to material consumption exists anywhere in this schema, and
  building one would be well beyond "designed to support." Staff adjust it by hand, same as they'd
  do on a spreadsheet today. "Low stock" is derived (`stock_quantity - reserved_quantity <=
  low_stock_threshold`) at read time, not stored — verified at both sides of the boundary (15
  available against a threshold of 10 → not low stock; 8 available against the same threshold → is
  low stock).
- **Verified live**, continuing Module 16's authenticated-session technique:
  `scripts/test-builder-inventory.mjs` covers builder-option CRUD through real RLS (admin
  create/update/delete across two structurally-different tables, a plain customer blocked, public
  read respecting `is_active`), the pricing-function live-update behavior, inventory RLS (admin-only,
  customer blind scan returns nothing), the low-stock boundary, and all 13 new/changed admin routes
  resolving with a genuine 200 via the same hand-built `@supabase/ssr` session cookie as Module 16.
  Re-ran Module 16's own dashboard/nav-link script afterward — still all 22 routes pass, confirming
  `/admin/builder` and `/admin/inventory` now render real content instead of `ComingSoon` without
  breaking anything else in the shell.

## Reviews, Testimonials & Social Proof (Module 18)

- **A real RLS gap found and fixed, not assumed away.** `reviews`' own UPDATE policy (`0009`,
  "author or admin") lets the review's author update *any* column on their own row, including
  `is_published`/`is_featured`/`admin_response` — nothing in RLS actually stopped a customer from
  self-publishing their own review by calling `supabase.from("reviews").update({is_published:
  true})` directly with their own session, bypassing moderation entirely. This app's own code never
  does that, but per this project's own discipline, RLS is the real boundary, not which buttons the
  UI happens to show. Fixed the same way Module 2's `profiles.role` self-promotion gap was fixed
  (`0017`/`0018`): a `before update` trigger, `security invoker` (not `definer` — `0018` found the
  hard way that `security definer` makes `current_user` resolve to the function owner for every
  caller, silently defeating a `current_user` check). Verified live: a customer's own attempt to
  self-publish or self-feature their review is rejected by the trigger, while editing a harmless
  field (title) on their own review still works, and admin can still publish/feature freely.
- **`reviews.reviewer_name` — a deliberate, approved reversal of a documented prior decision.**
  `getFeaturedTestimonials`'s own code comment explained why testimonials showed generic "Verified
  Customer" attribution: `profiles` SELECT RLS is owner/admin-only, so joining a real name at read
  time returns nothing for a public visitor, and the code deliberately chose not to open a new
  public-read carve-out on `profiles`. That reasoning holds for a join-at-read-time approach — this
  module instead captures a customer-chosen display name once at submission time (`reviewer_name`,
  one new nullable column), the same snapshot pattern already used for
  `enquiries.contact_name`/`appointments.contact_name`. `profiles`' RLS is never touched.
- **Verified-purchase badge is `review.order_id !== null`, not a live join.** The schema's own
  shape (`order_items.product_id`/`builder_configuration_id` both nullable, no constraint tying
  exactly one) makes a live "did this customer buy this product" join genuinely ambiguous for
  bespoke/builder orders. Sidestepped entirely: the submission flow only ever sets `order_id` after
  validating (server-side, not trusted from the client) that the order actually belongs to the
  reviewer and its shipment has reached `delivered` — so the stored `order_id` is trustworthy
  without re-deriving anything at display time.
- **The "Leave a Review" gate matches the exact signal that already fires Module 15's
  `review_request` notification** — a shipment reaching `delivered`, not `orders.status` (which
  Module 12 deliberately keeps unsynced from shipping status). Enforced server-side in
  `submitReview` too, not just hidden in the UI: a tampered `orderId` or a `productId` not actually
  in that order is rejected before anything is written.
- **Photo testimonials reuse Module 8's upload pipeline with a new bucket; video testimonials are
  references, not uploads.** `review-media` (new bucket, `0039`) mirrors `inspiration-images`/
  `media`'s exact shape (public read, no client-write RLS, uploads go through a Server Action after
  an in-app ownership check — here, `reviews.customer_id = auth.uid()`). Deliberately **not** the
  existing `media` bucket/table: `media` is `is_admin()`-only RLS end to end, so a customer's own
  photo written there could never be read back by them or by the public once the review is
  published — review photos belong in `review_media` (already correctly scoped: visible whenever
  the parent review is) with their own bucket for the files. No bucket anywhere accepts video MIME
  types, matching the plan's own "video testimonial *references*" wording — a video is just an
  external URL stored on `review_media.type = 'video'`, not a file.
- **Instagram gallery abstraction mirrors Module 14's shipping-provider shape exactly** — one
  `InstagramProvider` interface, one `MockInstagramProvider` (no real API credentials to integrate
  against, same deferral as Modules 11/14/17's PayPal/courier/product-image decisions), a factory.
  The mock isn't fake data — it reads `social_gallery_images` (new table, `0039`, same admin-write/
  public-read-when-active shape as the six builder-option tables), so the "Instagram gallery" is
  genuinely admin-curated today; a real Basic Display/Graph API implementation can swap in later
  without touching `SocialGallery`.
- **No new homepage sections — `Testimonials` and `SocialGallery` already existed and were already
  mounted**, built ahead of this module with real (if empty) data plumbing and an explicit
  placeholder comment on `SocialGallery`. This module filled in what was behind both slots rather
  than adding new ones.
- **No hard delete for reviews, by explicit approval** — `reviews` has no DELETE policy for anyone,
  not even admin, unlike every other admin-deletable table in this project; that absence reads as
  deliberate ("moderate by hiding, never erase outright"), so no delete action was built. Admin
  moderation is publish/unpublish, feature/unfeature (only a published review can be featured), and
  `admin_response`.
- **Verified live** via `scripts/test-reviews.mjs` (two customers, an admin, cleaned up after): the
  submission gate rejects a not-yet-delivered order and an order that isn't the caller's own; the
  new self-moderation trigger blocks self-publish/self-feature while still allowing a harmless
  field edit; `review_media` visibility follows its parent review and only the review's author can
  attach media to it; `social_gallery_images` respects `is_active` for public read while staying
  admin-write-only; all three new/changed routes resolve with a genuine 200 via the same
  hand-built `@supabase/ssr` session cookie as Modules 16/17, including confirming the gated review
  form never renders for an undelivered order (the same documented `redirect()`-during-render
  characteristic as `notFound()` — 200, not a real 3xx — so the check is on rendered content, not
  status code). Re-ran Modules 16's and 17's own scripts afterward with no regressions.

## Marketing & Customer Retention — Pass 1 (Module 19)

- **Split into two passes by explicit agreement**: Pass 1 (this section) covers the
  checkout/payment-linked features — coupons/discounts, loyalty points, referrals. Pass 2 covers
  customer segments, campaigns, newsletter unsubscribe, promotional banners, and the abandoned-cart
  cron job. `coupons`/`referrals`/`loyalty_accounts`/`loyalty_transactions` (`0010`) were schema-only
  since Module 1 — this pass is the first thing to actually build on them.
- **`coupons` genuinely has no customer-read RLS policy** — confirmed directly, not assumed: a
  customer's own `SELECT` on `coupons` returns nothing (0009's own header comment: "codes can't be
  scraped wholesale"). `validate_coupon`/`redeem_coupon` (`0041`) are the only way a customer
  session can check a code at all — both `security definer`. `validate_coupon` is read-only, used
  for the checkout "Apply" preview; `redeem_coupon` is the atomic, consuming version, locking the
  coupon row (`for update`) so concurrent checkouts against a limited-use coupon can't both
  succeed past `max_uses` — same race-safety discipline as `get_or_create_cart` (`0032`). Verified
  live: two genuinely concurrent redemption attempts against a `max_uses = 1` coupon — exactly one
  succeeds, `used_count` lands on exactly 1, never 0 or 2.
- **The checkout preview is never trusted as final.** `placeOrder` re-validates via `redeem_coupon`
  against the just-computed real subtotal (never the client's), matching this project's "never
  trust client-submitted prices" discipline throughout checkout. Coupons only apply to `placeOrder`
  (cart checkout), not `acceptQuotation` — a quotation's price is already a bespoke, admin-set
  figure; a customer-facing promo code doesn't fit that model.
- **Loyalty points**: `loyalty_accounts` was never auto-created anywhere (`0010`) — `handle_new_user()`
  now also creates one at signup, the same trigger Module 15 already extended once for the welcome
  notification. `earn_loyalty_points` is idempotent per `reference` (`payment:<id>` for real
  payments) — a retried webhook delivery is a no-op, not a double award, matching the idempotency
  bar `updateOrderAfterPayment` already set. Earn fires from both places a payment can actually
  succeed (the Stripe webhook and `markPaymentPaidManually`). A dedicated `adjust_loyalty_points`
  RPC (`0042`, a same-day follow-up) exists specifically so an admin manual correction is labeled
  `'adjust'` in the customer's own history — reusing `earn`/`redeem` for that would have mislabeled
  it. Redemption at checkout converts points to a capped discount (100 points = £1, `lib/loyalty/config.ts`
  — the one place both checkout logic and every display read the rate from) and stacks with a
  coupon if both are used.
- **Referrals: admin-triggered completion, not automatic on the referred customer's first order** —
  an explicit, approved scope call. Auto-completing would mean a new hook into `placeOrder` for a
  low-frequency feature that benefits from a human sanity-check anyway (self-referral via a second
  account, etc.). `referrals`' own RLS (`0010`) only lets the *referrer* insert/read their row and
  only admin update it — the *referred* person has no path to it at all, so `redeem_referral_code`
  (`security definer`) is the narrow exception that links a code to whoever signs up with it,
  nothing else. Each code is single-use by the schema's own shape (one row per referral
  relationship, not a standing reusable code) — a customer generates a new one per person they
  invite. A completed referral's reward is credited as real, redeemable loyalty points on the
  referrer's account, not just a number sitting on the `referrals` row.
- **`orders.discount_amount`/`coupon_id`/`loyalty_points_redeemed`** (new columns, `0041`) are
  computed and consumed *before* the order row is inserted — same "sequential awaits, best effort"
  risk model this function already operates under (an `order_items` insert failing after `orders`
  already succeeded isn't rolled back either); a coupon/points redemption succeeding right before
  an unrelated order-insert failure is an accepted, pre-existing class of risk, not a new one this
  pass introduced.
- **Verified live** via `scripts/test-marketing-pass1.mjs` (two customers, an admin, cleaned up
  after): every coupon rejection reason (inactive, expired, below minimum, unknown code, fixed
  discount capped at subtotal), the concurrent-redemption race test above, loyalty earn
  idempotency/redeem-insufficient-balance/adjust-either-sign, and the full referral lifecycle
  (generate → self-referral blocked → redeemed by someone else → re-redemption blocked → unknown
  code rejected). All new/changed routes resolve with a genuine 200 via the same authenticated-session
  technique as Modules 16-18. Re-ran Module 11's and Module 16's own scripts afterward — both still
  pass, confirming the webhook/admin-payments/admin-customers changes didn't regress anything.

## Marketing & Customer Retention — Pass 2 (Module 19)

- **`carts.updated_at` is NOT a "last cart activity" signal — this was a real bug caught during
  design, before any code was built on the wrong assumption.** The obvious way to find an abandoned
  cart is "active carts whose `updated_at` is older than N hours". That would have silently found
  almost nothing: `SiteHeader` calls `getCartItemCount()` on *every page view site-wide*, which
  calls `get_or_create_cart` (`0032`), whose `INSERT … ON CONFLICT DO UPDATE SET updated_at = now()`
  refreshes the column on any page load at all. A customer who never touches their cart again but
  keeps browsing would look perpetually active forever. `find_and_mark_abandoned_carts` (`0044`)
  therefore keys off `MAX(cart_items.updated_at)` — a column that only moves when an item is
  genuinely added/updated/removed — expressed as a `GROUP BY … HAVING` aggregate, which is why it's
  a SQL function rather than something assembled through the JS client's filter API. Verified
  directly: a cart whose only item was last touched 2 days ago but whose `carts.updated_at` was
  deliberately bumped to `now()` **is** correctly marked abandoned, while a cart with a fresh item
  is not.
- **Related pre-existing characteristic (not introduced here, not fixed here):** because
  `get_or_create_cart` runs on every anonymous page view, empty guest `carts` rows accumulate
  steadily — several test runs added a dozen. They're harmless to the cron (it inner-joins
  `cart_items`, so a cart with no items is never a candidate), but it is a real source of table
  growth that belongs to the cart module, not this one.
- **Customer segments are computed tags, not persisted membership** (approved scope call).
  `lib/admin/customer-segments.ts` derives `vip` / `new` / `at_risk` at read time from the exact
  aggregate `getAdminCustomers()` already builds, rather than introducing a segment table and a
  rule-builder system. `getAdminCustomers()` gained `lastOrderAt` for the at-risk rule; the
  thresholds live as three named constants in one file. `/admin/customers?segment=` filters via
  plain server-rendered `<Link>` pills — no client state.
- **Campaign sends deliberately bypass `notify()`.** `sendCampaign` calls `sendMockEmail` directly,
  keeping marketing content out of the transactional in-app notification feed (orders, payments,
  shipping) even though both ultimately reach the same mock provider — the free-first provider
  pattern from Module 15, not a rebuild of it. `getCampaignRecipients` is also the one place a bulk
  `auth.admin.listUsers()` is justified: unlike the admin customer *list* (which deliberately avoids
  it), a send genuinely needs every matching recipient's email at once.
- **Newsletter unsubscribe is another guest-inaccessible-row case.** A subscriber has no account and
  no RLS path to their own row (`0020`: select/update/delete are admin-only), so `unsubscribe_newsletter`
  (`0043`) is a narrow `security definer` RPC gated on a per-row `unsubscribe_token` — the same
  token-gated shape as builder share tokens and referral redemption. The action reports the same
  generic result for a valid, an already-used, and an unknown token, so it can't be used to probe
  which tokens exist. Existing subscriber rows picked up backfilled tokens from the column's
  `not null default gen_random_uuid()`, confirmed against the one real pre-existing subscriber.
- **Promotional banners replace Module 3's announcement toggle rather than sitting alongside it.**
  `store.announcement_enabled` / `store.announcement_text` are gone from `SiteSettings` and from
  `applyRow`'s switch; leftover `site_settings` rows with those keys are harmlessly ignored by the
  default case. Stacking both mechanisms would have rendered two banners at once. RLS gates only
  `is_active` (public read when active or admin); the schedule window (`starts_at`/`expires_at`) is
  applied in `getCurrentBanner()`, matching how coupons handle their own window. Note that chained
  `.or()` calls in the Supabase JS client AND together — each contributes one OR-group — which is
  what makes the two-window filter express correctly in a single query.
- **First scheduled task in the project.** `vercel.json` registers a daily Vercel Cron hitting
  `/api/cron/abandon-carts`; no cron/queue infrastructure existed anywhere before this. The route
  verifies `Authorization: Bearer $CRON_SECRET` the same way the Stripe webhook checks its own
  secret, and skips the check when `CRON_SECRET` is unset — matching the project's existing
  "unset = not configured yet" tolerance, but it **must** be set before any real deploy or the
  endpoint is open. Guest carts are still marked abandoned but never notified: there is genuinely
  no contact info captured for them anywhere in the schema.
- **Verified live** via `scripts/test-marketing-pass2.mjs` (an admin plus four customers shaped to
  hit each segment case, cleaned up after): segment thresholds including the negative cases, the
  `?segment=` filter's *rendered* rows, the unsubscribe token round-trip and its non-disclosure
  behavior, campaign draft→sent lifecycle with the recipient preview, banner RLS/schedule/priority,
  the `carts.updated_at` test above, and the cron route end-to-end — 401 with no header, 401 with a
  wrong secret, 200 with the right one, the cart actually transitioning to `abandoned`, and a real
  `abandoned_cart` notification row plus mock email for the signed-in customer. Two script-writing
  gotchas worth knowing for future modules: in dev, Next.js embeds the **raw, unfiltered** server
  fetch responses in the RSC flight payload, so a whole-document substring check will report a
  filtered-*away* row as present — assert against the rendered `<tbody>` instead; and React splits
  adjacent text/interpolation nodes with `<!-- -->` markers, so `"Will send to 1 recipient"` arrives
  as `"Will send to <!-- -->1<!-- --> recipient"` and must be normalized before matching.
- **Pre-existing bug found while regression-testing, deliberately left unfixed (out of scope):** the
  homepage's own `generateMetadata` returns `title: settings.homepage.seoTitle ?? undefined`, and an
  explicit `undefined` *overrides* the root layout's `title.default` in Next.js rather than
  inheriting it — so with `homepage.seo_title` unset the homepage renders **no `<title>` tag at
  all**. Confirmed against a clean checkout with this module's changes stashed, so it is not a
  Module 19 regression. `scripts/test-settings-render.mjs` still asserts it (and still fails) on
  purpose, annotated in place, rather than deleting a check that exposes a genuine defect. Belongs
  to the SEO module. **Fixed in Module 20 Pass 1** — the homepage now routes through
  `buildMetadata`, which always resolves a real title, and that check now passes.

## SEO Foundation — Pass 1 (Module 20)

Everything public-facing now emits real metadata. The design goal was **one** place where
canonical/OG/Twitter rules live, so no page can drift.

- `lib/seo/build-metadata.ts` — `buildMetadata()` is the single entry point every public page's
  `generateMetadata` calls. It resolves each field down a fixed precedence chain: **admin
  `seo_metadata` override → the entity's own field → `site_settings` defaults → `siteConfig`**.
  Because the last link is a hardcoded constant, a title/description can never come out empty —
  which is exactly what fixed the missing-`<title>` bug above.
- `lib/seo/urls.ts` — `absoluteUrl()`/`absoluteAssetUrl()`. Canonicals, OG tags, JSON-LD and the
  sitemap all require absolute URLs, so they all funnel through here and `NEXT_PUBLIC_SITE_URL`
  stays the single place the deployed origin is configured. Note Next.js normalises a root
  canonical against `metadataBase` and drops the trailing slash (`http://host/` → `http://host`) —
  expected, not a bug.
- `lib/seo/structured-data.ts` — pure JSON-LD builders (Organization, WebSite, Product,
  BreadcrumbList, FAQPage, BlogPosting). No React, no DB: plain data in, plain object out. They
  `compact()` away empty fields and **omit rather than invent** — `aggregateRating` is only emitted
  when real reviews exist, since fabricating one is both a Google penalty and a lie.
- `lib/seo/get-seo-metadata.ts` — reads the polymorphic `seo_metadata` table created back in
  Module 1 (`entity_type` + `entity_id`, unique together) that nothing had consumed until now.
  `SEO_ENTITY_TYPES` is the app-side allow-list so a typo can't write rows nothing reads back.
- `components/seo/json-ld.tsx` — escapes `<` to `<` before injecting. Without this a product
  name containing `</script>` breaks out of the JSON-LD block into executable markup; there's a
  regression test for exactly that.
- `components/seo/breadcrumbs.tsx` — renders the visible trail *and* emits `BreadcrumbList`, so one
  component covers both the internal-linking and structured-data requirements.
- `app/sitemap.ts` / `app/robots.ts` — Next.js metadata routes. The sitemap reads through the same
  cached catalog helpers the storefront uses, so it can never list a product the storefront
  wouldn't render (both filtered by `status = 'published'` / `is_active`, with RLS underneath).
- **`seo.indexingEnabled` defaults to `false`.** Until the owner turns it on in Admin → SEO,
  `robots.txt` blocks everything *and* every page carries `noindex` — robots.txt alone does not
  remove already-known URLs from an index, so both are needed. This is deliberate: a staging or
  pre-launch deploy must never be crawled by accident. **Remember to enable it at launch.**
- Both new settings keys (`seo.indexing_enabled`, `seo.google_site_verification`,
  `seo.twitter_handle`) needed **no migration** — `site_settings` is a key/value table, so they are
  just new cases in `applyRow`.
- **Verified live** via `scripts/test-seo-pass1.mjs` (56 checks, self-cleaning, exits non-zero on
  failure): sitemap contents including the negative cases (a draft product and every private path
  must be absent), robots.txt in *both* indexing states, canonical/OG/Twitter tags, JSON-LD
  validity and field-level correctness, the override precedence chain, and the `</script>`
  escaping.

## Content Management & Admin SEO — Pass 2 (Module 20)

- **`faqs` (0045) is the only new table.** `blog_posts`, `pages`, `media` and `seo_metadata` all
  already existed from Module 1 and had simply never been consumed. FAQs are a real table rather
  than prose inside a `pages` row because Modules 22/23 need a "deterministic FAQ engine" over a
  "safe knowledge source" — question/answer rows are that source, and neither the `FAQPage` schema
  nor the future chatbot should have to parse HTML.
- **CMS pages live at the root** (`/about`, `/terms`) via `(storefront)/[slug]`, an owner decision
  over a `/pages/` prefix. Next.js always matches static segments before a dynamic one, so real
  routes win outright — there's a test that inserts a page with slug `products` straight through
  the service role (bypassing validation) and asserts `/products` still renders the catalog.
- **`lib/routes/reserved-slugs.ts` is deliberately dependency-free** and shared by two callers that
  must never disagree: `lib/validations/content.ts` rejects reserved slugs at write time, and
  `lib/supabase/middleware.ts` skips them when deciding whether an unknown root path should 404.
  It imports nothing because middleware runs on the Edge runtime.
- **The soft-404 fix extends the Module 10 follow-up pass.** `notFound()` thrown during rendering
  still returns HTTP 200 in this Next.js version (see the routing section above), and Pass 2 added
  two more crawlable dynamic routes, so `middleware.ts` gained existence checks for `/blog/[slug]`
  and the root CMS `[slug]`. The root check is the important one: without it *every* unknown URL
  on the site returned 200 with not-found content, which is exactly the soft-404 Google penalises.
  Verified against a real production build (`next build && next start`), not dev — the same
  discipline that earlier pass established, because this is dev-mode-adjacent behavior.
- **`components/shared/storefront-image.tsx` optimizes what it can prove is safe.** `next/image`
  throws and takes the whole page down if the host isn't in `next.config.mjs`'s `remotePatterns`.
  Catalog images are Supabase Storage URLs and always fine, but several admin fields (blog cover
  image, share images) are free text, so an admin can paste anything. `StorefrontImage` uses
  `next/image` for app-relative paths and the configured Supabase host, and falls back to a plain
  `<img>` otherwise — an unoptimized image beats a 500 on a customer-facing page. `alt` is a
  required prop, not optional-with-a-default. `next.config.mjs`'s hostname is now derived from
  `NEXT_PUBLIC_SUPABASE_URL` (with the literal as fallback) so another Supabase project works
  without editing the file.
- **Scope call: the header logo stays a plain `<img>`.** It's intrinsically sized (`h-8 w-auto`)
  with an unknown aspect ratio, so it fits neither `fill` (needs a sized parent) nor explicit
  width/height. Admin, account and builder images are also unconverted — Module 28 owns that.
- **`components/content/rich-text.tsx` renders plain text, never `dangerouslySetInnerHTML`.**
  Piping stored content into the DOM would make the admin content editor a stored-XSS vector, and
  no markdown renderer (or sanitizer) is a dependency of this project yet. Adding one is a real
  decision for its own module, not a side effect of the SEO pass.
- **`updateSeoDefaults` is scoped to the `seo.*` namespace only.** Module 25 owns the full admin
  settings screen; a generic "write any key" action would pre-empt it *and* hand the client control
  over which key gets written. Empty fields delete their row rather than storing `""`, so
  `getSiteSettings()` falls back through to `siteConfig` as designed.
- **Verified live** via `scripts/test-seo-pass2.mjs` (65 checks, self-cleaning, exits non-zero on
  failure), run against a production build: published-vs-draft visibility for posts/pages/FAQs at
  both the route and the RLS level (anonymous and plain-customer inserts/updates are rejected, not
  merely filtered), the route-shadowing test above, FAQPage/BlogPosting structured data, footer
  internal linking, per-entity overrides, and admin route authorization. Re-ran Modules 3, 4, 5, 10
  and 18's own scripts afterwards with no regressions.
- **A test-writing gotcha that contradicts Module 19's:** that module narrowed assertions to the
  rendered `<tbody>` because dev-mode Next.js embeds unfiltered fetch responses in the RSC flight
  payload. That does *not* generalise — with streaming, `<main>` is emitted nearly empty (~100
  bytes) and the content arrives later in the payload, so a `<main>` slice makes every positive
  check fail for the wrong reason. Whole-document checks are correct when the fetcher filters at
  the *query* level (a draft row is never fetched, so it can't be in the payload). Only
  fetch-then-filter-in-JS pages need a narrower signal — `/admin/seo`'s negative check asserts on a
  `value="<uuid>"` attribute, which exists only in rendered markup.

## Analytics & Tracking (Module 21)

Full operational detail is in `docs/ANALYTICS.md`. The architectural points:

- **`lib/analytics/events.ts` is the single source of truth.** The 13 event names, the
  client-sendable subset, the transaction subset and the funnel definition all live there, so a
  producer and the reporting layer can never disagree about what an event is called. It imports
  nothing — client components, Server Actions and the Edge runtime all pull from it.
- **`lib/analytics/` follows the `lib/social/`+`lib/shipping/` shape**: `provider.ts` interface,
  `supabase-provider.ts` (the free default, writing to `analytics_events`), `mock-provider.ts`,
  `index.ts` factory. `track()` never throws — a failed analytics write must not break the
  operation the customer actually performed, so it warns and returns.
- **Consent is enforced in `trackServer()`, not at each call site.** An instrumented Server Action
  just calls `trackServer()`; that function decides whether anything is written. A future action
  therefore cannot forget the consent check, which is the failure mode that matters here.
- **Two capture paths, deliberately.** High-frequency browser events (`page_view`, `product_view`,
  `checkout_started`) go to `/api/analytics` via `navigator.sendBeacon` — non-blocking and
  surviving page unload, which a Server Action round trip is not. Everything else is emitted
  server-side from the action that already performs the operation, where the data is trustworthy.
- **The ingest route's validation IS the security boundary.** `analytics_events` is
  insert-by-anyone at the RLS level (that is what allows anonymous visitors to be measured at all),
  so the route enforces a client-event allow-list — `purchase` can never be forged from a browser —
  plus a payload size cap, a server-side consent re-check and a basic bot filter.
- **The consent cookie is read on the server**, in `(storefront)/layout.tsx`, and passed into the
  banner and pixels as `initialConsent`. Found during testing: without it the banner rendered only
  after hydration, so it was absent from the server HTML entirely — a pop-in and a layout shift for
  every new visitor. Cookies are readable server-side; there was no reason to wait for the client.
- **`analytics_session` is a separate cookie from `cart_session`.** Reusing the cart cookie would
  have turned a strictly-necessary cookie into a consent-requiring one, meaning no cart without a
  cookie prompt.
- **0046's three reporting functions are SECURITY INVOKER**, unlike `find_and_mark_abandoned_carts`
  (0044) which needs definer rights to mutate carts. These only read, so running as the caller lets
  the existing admin-only SELECT policy govern them — no bypass to guard, and no `is_admin()` check
  a later edit could drop. `scripts/test-analytics.mjs` asserts an anonymous caller gets zero rows
  from the RPC, which is what proves this.
- **The funnel counts DISTINCT sessions, not rows.** One visitor viewing ten products is one
  "product view" step; counting rows would report a 10% add-to-cart rate where the truth was 100%.
  It also makes the consent-less-purchase carve-out safe: those rows have `session_id = null`,
  which `count(distinct session_id)` ignores, so they can never push a step above the one before it.
- **Charts are hand-rolled inline SVG; no charting library was added** for two visualisations. The
  trend is **small multiples** — one panel per funnel step, each on its own scale — because product
  views outnumber purchases by an order of magnitude, and the alternatives were a dual y-axis
  (never correct) or flattening purchases into the baseline. Colour comes from the Module 3
  semantic tokens, so both themes work without hardcoded hexes.
- **Retention is enforced, not just documented**: `/api/cron/purge-analytics` deletes rows past 14
  months, monthly via `vercel.json`, reusing the `CRON_SECRET` check from the abandoned-cart cron.
  It uses the service-role client because `analytics_events` has no DELETE policy for anyone —
  purging is a scheduled system job, not something a signed-in admin should trigger by hand.
- **Verified live** via `scripts/test-analytics.mjs` (45 checks, self-cleaning, exits non-zero on
  failure) against a production build: consent gating in all three states, ingest validation
  including a forged `purchase` attempt and an oversized payload, RLS from anonymous/customer/admin
  perspectives, deterministic funnel arithmetic (a repeat view must not double-count), retention
  purge cutoff correctness, and admin access control. **Two further checks — that the purge cron
  rejects a missing and a wrong bearer token — are conditional on `CRON_SECRET` being set and are
  therefore SKIPPED locally, where it isn't.** Re-run the script in an environment that sets it
  (as any real deploy must) to exercise them; the same conditional applies to the abandoned-cart
  cron from Module 19. The rendered admin page was
  also inspected with seeded data to confirm funnel geometry and no NaN in the SVG paths.

## AI Foundation (Module 22)

Operational detail is in `docs/AI.md`. The architectural points:

- **The interface is narrow on purpose, and that is the security design.** `AiProvider`
  (`lib/ai/provider.ts`) exposes exactly four capabilities — answer, recommend, describe, draft —
  and no general `complete()`. No method takes a table, an id or a status, so "AI must never alter
  payment records / order status / bypass admin controls" is true because **no call path exists**,
  not because a prompt asks nicely. Resist adding a general completion method in Modules 23/24;
  that single change would dissolve the guarantee.
- **`guardrails.ts` runs over EVERY provider's output, including the deterministic one.** A prompt
  is a request, not a guarantee, so the enforcement is post-hoc pattern matching: all monetary
  amounts, all delivery timescales, and all order/payment status claims are redacted. It redacts
  *every* amount, not just wrong ones — once a figure is loose in prose there is no way to tell an
  accurate one from an invented one, and this business runs on an admin-set Final Admin Quote.
  Admin drafts show redacted text plus a warning (the admin is editing anyway); customer-facing
  answers are discarded entirely via `guardedOrNull()`, because a customer must never see redaction
  markers.
- **Three modules are deliberately import-free** — `guardrails.ts`, `faq-matching.ts` and
  `provider-selection.ts`. That is what lets `scripts/test-ai.mjs` import the `.ts` sources directly
  under Node 24's type stripping and unit-test them exhaustively (73 checks, most of them
  guardrails) instead of only observing them through a rendered page. Keep them dependency-free.
- **The Claude provider falls back to the deterministic one on every failure path** — API error,
  refusal, timeout, or a response that fails schema validation — so an AI outage degrades quality
  and never availability. `selectProvider()` mirrors `isStripeConfigured()`: no key means the free
  engine, and the whole app works that way.
- **Recommendations never touch a model.** Ranking by co-view/co-purchase counts is arithmetic;
  paying a model to redo it would be slower, costlier and less accurate. `ClaudeAiProvider`
  delegates `recommendProducts` straight to the deterministic implementation.
- **Affinity is product→product, never per-visitor.** `recommendations.ts` asks "which products
  appeared in the same session as this one", never "what has this person viewed". That keeps it
  inside the purpose disclosed in the Module 21 consent banner; per-person profiling from
  analytics-consented data would exceed it and need its own consent category.
- **`getRelatedProducts()` now delegates to the engine** and preserves its ranking — `.in()` returns
  rows in arbitrary order, so the result is re-sorted back into the engine's order. Two behaviour
  changes: a product with no category now gets recommendations (previously none), and every tier
  re-filters on `status = 'published'`, so a draft with historical affinity data can never resurface.
- **`ai_generations` is admin-only for insert as well as select**, unlike `analytics_events`
  (insert-by-anyone, so anonymous visitors can be measured). Nothing here is written by a visitor —
  generation is an admin action — so there is no reason to open the insert side.
- **Cleanup gap found and fixed in a prior module's test:** Module 21 made the Stripe webhook emit
  `payment_completed`, which meant `scripts/test-payments.mjs` (written earlier) started leaving
  `analytics_events` rows behind. Its teardown now clears them. Worth remembering as a pattern —
  instrumenting an existing flow can silently break an older script's cleanup.
- **The Claude happy path is UNVERIFIED.** No `ANTHROPIC_API_KEY` was available; request shapes
  follow the current SDK docs (`messages.parse` + `zodOutputFormat`, model `claude-opus-5`, adaptive
  thinking, low effort) and the fallback paths are tested, but no successful live response has been
  observed. Same deferral Modules 11/14 made for PayPal and couriers.

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
  `lib/enquiries/`, `lib/cart/` — server-only read fetchers per feature area. Fetchers with no
  parameters (option/lookup lists — `get-options.ts`, `get-field-definitions.ts`,
  `get-products.ts`, `get-types.ts`, etc.) use `React.cache` like `lib/settings/`; fetchers
  parameterized by the current request (a specific id+token, the signed-in user, an admin status
  filter) don't, since there's nothing to usefully dedupe across a single call. `lib/cart/session.ts`
  is the one exception with two variants of the same helper — `getOrCreateCartSessionId()` for
  Server Actions (can mutate cookies) and `peekCartSessionId()` for Server Components (read-only;
  see Module 10 above for why that split exists).
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
