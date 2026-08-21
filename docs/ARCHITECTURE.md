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
