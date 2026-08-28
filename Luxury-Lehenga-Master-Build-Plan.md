# Luxury Lehenga E-Commerce Platform — Claude Code Master Build Plan

## 0. Purpose of This Document

This document is the **Master Build Plan and Source of Truth** for a premium UK-based custom lehenga designing and tailoring eCommerce platform.

The project must NOT be built all at once.

Claude Code must use this document as the long-term implementation roadmap. Each module will be completed in a separate Claude Code chat.

The owner/developer will start a new chat and say, for example:

> Start Module 0 from the Master Build Plan.

or:

> Start Module 1 from the Master Build Plan.

Claude must then work ONLY on that requested module, complete it properly, verify it, and update the module status in this plan.

When a module is completed, Claude must mark it:

`[x] COMPLETE`

and must not silently skip unfinished work.

---

# 1. Project Vision

Build a **modern, premium, luxury custom lehenga eCommerce platform** for a UK-based business that designs and tailors custom lehengas.

The platform should provide a complete digital customer journey:

Customer discovers brand
→ browses collections
→ creates/customizes a lehenga
→ submits inspiration
→ provides measurements
→ requests consultation/enquiry
→ receives quotation
→ confirms order
→ pays deposit
→ production begins in Pakistan
→ quality control
→ shipment to UK/international destination
→ tracking updates
→ remaining balance paid before shipping where applicable
→ delivery
→ review/testimonial
→ loyalty/referral/marketing lifecycle.

The website should feel like a **luxury fashion house**, not a generic Shopify-style template.

Design goals:

- Premium
- Elegant
- Editorial
- Feminine
- Modern
- Trustworthy
- High-end
- Responsive
- Fast
- Accessible
- SEO-friendly
- Conversion-focused
- Highly customizable from Admin Settings

---

# 2. NON-NEGOTIABLE DEVELOPMENT RULES

Claude Code MUST follow these rules throughout the project.

## 2.1 Module-based development

Never attempt to implement the whole platform in one module.

Each module must have:

1. Clear objective
2. Requirements
3. Architecture decisions
4. Database requirements
5. UI requirements
6. Backend/API requirements
7. Security requirements
8. Validation
9. Testing
10. Documentation
11. Completion checklist

---

## 2.2 Master Plan is the source of truth

This file controls the overall roadmap.

Do not randomly redesign the architecture.

Do not introduce a different framework without explicit approval.

Do not replace Supabase with another backend.

Do not replace Next.js with another frontend framework.

Do not introduce paid services when a reasonable free/open-source alternative exists during development.

If a requirement normally requires a paid service:

1. Identify the paid dependency.
2. Find a free/local/manual alternative.
3. Implement the free alternative where practical.
4. Document what will be replaced when the business goes live commercially.

---

## 2.3 Approved stack

### Frontend

- Next.js 15 (updated from the original "Next.js 14" during Module 0 — the project was already
  scaffolded on 15.5.23; confirmed with the project owner rather than downgrading)
- React 18
- TypeScript
- Tailwind CSS v4 (updated from v3 during Module 0 — the installed shadcn "base-nova" style
  requires v4's CSS-first `@theme`/`@utility` syntax; confirmed with the project owner)
- App Router

### Backend

- Supabase
  - PostgreSQL
  - Supabase Auth
  - Supabase Storage
  - Row Level Security
  - Supabase Edge Functions where appropriate

### Deployment

- Vercel free tier during development

### Code quality

- TypeScript strict mode
- ESLint
- Prettier
- Reusable components
- Feature/module-based architecture
- Clean separation of UI, business logic and data access

### UI

Use a modern component system where it improves consistency, preferably:

- shadcn/ui
- Radix primitives where appropriate
- Tailwind CSS
- Lucide icons

### Animation

Use free/open-source animation tools.

Preferred:

- Framer Motion / Motion

Animations must be:

- smooth
- subtle
- premium
- purposeful
- performant
- disabled/reduced when `prefers-reduced-motion` is enabled

Avoid excessive animations.

---

# 3. FREE-FIRST DEVELOPMENT POLICY

During development, the entire project should run with free-tier or open-source services whenever reasonably possible.

## Preferred free options

### Authentication

Supabase Auth.

### Database

Supabase PostgreSQL.

### File storage

Supabase Storage.

### Hosting

Vercel free tier.

### Email development

Use a local/mock email provider or Supabase-compatible development workflow.

Production email provider can be added later.

### WhatsApp

Do NOT require paid WhatsApp API during development.

Create a notification abstraction/service so production WhatsApp Business Cloud API can be plugged in later.

For development:

- WhatsApp deep links
- admin-generated messages
- mock notification provider

### Payments

Create a payment abstraction.

For development:

- Stripe test mode
- PayPal sandbox

No real payment processing during development.

### Shipping

Use mock shipping rates/tracking during development.

Build a shipping provider abstraction so a real courier API can be connected later.

### AI

Do NOT make the entire platform dependent on a paid AI API.

Build an AI provider abstraction.

Development fallback:

- rule-based recommendations
- predefined FAQ responses
- mock AI responses
- local/static recommendation engine

Production AI providers can be connected later.

### Analytics

Use:

- local development analytics abstraction
- Google Analytics integration prepared but optional
- Meta Pixel integration prepared but optional
- TikTok Pixel integration prepared but optional

### CRM

Use an internal customer/event model initially.

Production CRM integration should be adapter-based.

---

# 4. IMPORTANT BUSINESS RULE

The original requirement mentioned live price updates.

However, this business operates as a custom luxury tailoring service.

Therefore:

## Recommended architecture

The Lehenga Builder should support:

- selectable options
- design configuration
- internal estimated pricing rules if enabled
- quotation request

BUT the final customer price should be controlled by Admin.

Admin must be able to configure:

- base prices
- option prices
- fabric price adjustments
- embroidery adjustments
- customization charges
- urgency charges
- shipping
- discounts
- deposits
- taxes if applicable

The system must support:

`Estimated Price`

and separately:

`Final Admin Quote`

Admin should be able to override any estimated amount before the customer confirms the order.

---

# 5. BRANDING & DESIGN SYSTEM

The website must have a centralized design system.

Admin should eventually be able to configure:

- Brand name
- Logo
- Favicon
- Primary color
- Secondary color
- Accent color
- Background color
- Text colors
- Button styles
- Border radius
- Typography
- Heading font
- Body font
- Announcement bar
- Social links
- Contact details
- WhatsApp number
- Footer content
- SEO defaults

The actual design system must still have sensible developer defaults.

Do NOT make the site visually dependent on hardcoded brand values scattered across components.

Use centralized theme tokens/CSS variables.

---

# 6. PREMIUM UX DIRECTION

The visual direction should be inspired by:

- luxury fashion editorials
- couture houses
- premium bridal websites
- high-end fashion magazines

Design characteristics:

- large editorial imagery
- elegant whitespace
- sophisticated typography
- subtle gold/neutral accents
- smooth page transitions
- hover effects
- image reveal animations
- scroll animations
- premium buttons
- elegant cards
- subtle glass/blur effects only where appropriate
- immersive product galleries

Do not copy another brand.

Create an original visual identity.

---

# 7. CORE USER ROLES

The system should support:

## Guest

Can:

- browse products
- browse collections
- use builder
- submit enquiry
- book consultation
- add wishlist only after login or with temporary local wishlist
- create account
- start checkout

## Customer

Can:

- manage profile
- manage measurements
- manage wishlist
- manage addresses
- create configurations
- submit enquiries
- book consultations
- place orders
- pay deposits
- pay balances
- track orders
- receive notifications
- review orders

## Admin

Can:

- manage website
- manage products
- manage collections
- manage builder options
- manage customers
- manage measurements
- manage enquiries
- manage quotations
- manage orders
- manage production
- manage inventory
- manage payments
- manage shipping
- manage reviews
- manage coupons
- manage referrals
- manage loyalty
- manage marketing
- manage SEO
- manage content
- manage analytics
- manage theme
- manage system settings
- manage admins/roles

## Production Team

Optional role.

Can access only production-related information.

## Operations/Staff

Optional role with configurable permissions.

---

# 8. HIGH-LEVEL ARCHITECTURE

Use a modular architecture.

Suggested application layers:

```text
Presentation Layer
    ↓
Feature / Domain Layer
    ↓
Application / Service Layer
    ↓
Repository / Data Access Layer
    ↓
Supabase
```

Do not put all business logic directly into React components.

Use reusable services and domain functions.

---

# 9. SUGGESTED PROJECT STRUCTURE

Use a scalable structure similar to:

```text
src/
  app/
    (storefront)/
    (auth)/
    (account)/
    (admin)/
    api/

  components/
    ui/
    layout/
    shared/
    forms/
    commerce/
    builder/

  features/
    auth/
    customers/
    products/
    collections/
    builder/
    measurements/
    appointments/
    enquiries/
    quotations/
    cart/
    checkout/
    orders/
    payments/
    production/
    shipping/
    reviews/
    wishlist/
    marketing/
    loyalty/
    referrals/
    notifications/
    ai/
    analytics/
    seo/
    content/
    admin/

  lib/
    supabase/
    auth/
    validations/
    utils/
    constants/
    config/
    services/

  hooks/

  types/

  styles/

  middleware.ts
```

The exact folder structure may be refined during Module 0 if a better Next.js 14 architecture is justified, but changes must be documented.

---

# 10. DATABASE PRINCIPLES

Supabase PostgreSQL is the source of truth for business data.

Every important table must have:

- UUID primary key
- created_at
- updated_at where appropriate
- appropriate indexes
- foreign keys
- sensible constraints
- RLS policies where applicable

Never expose privileged service-role credentials to the browser.

Use server-side access for privileged operations.

---

# 11. SECURITY PRINCIPLES

Security is part of every module.

Required:

- Supabase RLS
- role-based access control
- secure server-side operations
- environment variables
- no secret keys in client code
- file upload validation
- image size/type validation
- server-side validation
- rate limiting strategy
- protected admin routes
- secure webhook verification
- ownership checks
- audit logs for sensitive admin actions

Never trust client-submitted prices.

Never trust client-submitted order status.

Never trust client-submitted role information.

---

# 12. MASTER MODULE ROADMAP

The project will be implemented in the following modules.

---

# MODULE 0 — PROJECT FOUNDATION & MASTER ARCHITECTURE

Status: [x] COMPLETE

Goal:

Create the professional foundation of the entire application before building business features.

Tasks:

1. Analyze this Master Build Plan.
2. Create/verify Next.js 14 application.
3. Configure TypeScript.
4. Configure Tailwind.
5. Configure ESLint.
6. Configure Prettier.
7. Install required free/open-source dependencies.
8. Configure Supabase.
9. Configure environment variables.
10. Create project architecture.
11. Create theme system.
12. Create reusable UI foundation.
13. Configure shadcn/ui if selected.
14. Configure Motion/Framer Motion.
15. Configure error handling.
16. Configure logging.
17. Configure loading states.
18. Configure empty states.
19. Configure toast/notification system.
20. Create basic layouts.
21. Create route groups.
22. Create README.
23. Create development setup documentation.
24. Create architecture documentation.
25. Verify production build.

Deliverables:

- Working Next.js 14 application
- Clean architecture
- Supabase connection
- Theme foundation
- UI foundation
- Documentation

---

# MODULE 1 — DATABASE ARCHITECTURE & SUPABASE FOUNDATION

Status: [x] COMPLETE

Design the complete scalable database architecture.

Initial domains:

- profiles
- roles
- permissions
- customers
- addresses
- products
- product_images
- collections
- categories
- fabrics
- embroidery_types
- colours
- sleeve_styles
- necklines
- dupatta_options
- builder_configurations
- measurements
- measurement_profiles
- inspiration_images
- wishlists
- wishlist_items
- carts
- cart_items
- enquiries
- quotations
- orders
- order_items
- payments
- payment_transactions
- production_orders
- production_status_history
- shipping_orders
- shipping_events
- appointments
- notifications
- reviews
- coupons
- referrals
- loyalty_accounts
- loyalty_transactions
- blog_posts
- pages
- media
- seo_metadata
- analytics_events
- audit_logs
- site_settings
- theme_settings

Do not blindly create every table if a better normalized architecture is identified.

Deliver:

- SQL migrations
- relationships
- indexes
- RLS
- seed data
- Supabase setup documentation

---

# MODULE 2 — AUTHENTICATION, AUTHORIZATION & CUSTOMER ACCOUNTS

Status: [x] COMPLETE

Implement:

- registration
- login
- logout
- email verification
- forgot password
- reset password
- session management
- protected routes
- customer profile
- addresses
- role system
- admin protection
- staff permissions

Customer dashboard foundation:

- Profile
- Orders
- Measurements
- Wishlist
- Addresses
- Consultations
- Notifications
- Payments

---

# MODULE 3 — DESIGN SYSTEM, BRANDING & GLOBAL SETTINGS

Status: [x] COMPLETE

Build the complete design system.

Store configurable settings in Supabase.

Admin can control:

- logo
- favicon
- colors
- typography
- buttons
- announcement bar
- social links
- contact information
- footer
- homepage settings
- global SEO defaults

Create:

- theme provider
- CSS variables
- design tokens
- responsive breakpoints
- typography system
- reusable components

---

# MODULE 4 — PUBLIC STOREFRONT & LUXURY HOMEPAGE

Status: [x] COMPLETE

ADDED LATER: an "Admin Panel" link in the site header, visible only to
staff. It uses isStaffRole() from lib/auth/session.ts — the same function
the (admin) layout and the middleware gate use — so what the header offers
and what the guard admits can never disagree, and a role added in a future
module is covered automatically.

HIDING IT IS COSMETIC and the code says so. /admin is protected by
middleware, the layout guard and RLS underneath; the link only stops a
customer being shown a door they cannot open.
scripts/test-admin-header-link.mjs (16 checks) asserts all nine admin
roles see it, that a customer and a signed-out visitor do not — including
that the label itself does not leak — and that both are still bounced with
a 307 if they type /admin directly.

The header now resolves getProfile() rather than getAuthUser(); it is
memoized per request via React.cache, so this costs no extra round trip.

Build:

- homepage
- navigation
- mega menu if needed
- hero section
- featured collections
- featured products
- craftsmanship section
- process section
- testimonials
- Instagram/social gallery placeholder
- consultation CTA
- newsletter section
- footer

Animations:

- hero reveal
- image parallax where appropriate
- scroll reveal
- hover animations
- page transitions

Must remain performant.

---

# MODULE 5 — PRODUCT & COLLECTION MANAGEMENT

Status: [x] COMPLETE

Customer storefront:

- product listing
- product detail
- image gallery
- variants
- fabrics
- colours
- embroidery
- related products
- wishlist
- enquiry CTA

Admin:

- CRUD products
- CRUD collections
- categories
- images
- product SEO
- featured products
- publish/unpublish

---

# MODULE 6 — CUSTOM LEHENGA BUILDER

Status: [x] COMPLETE

Build the core customization experience.

Options:

- lehenga style
- fabric
- embroidery
- colour
- sleeve
- neckline
- dupatta
- custom notes
- inspiration uploads

UX:

- multi-step builder
- progress indicator
- preview area
- responsive mobile experience
- save configuration
- edit configuration
- share configuration
- request quotation

Pricing:

- configurable estimated pricing
- admin-controlled pricing rules
- final admin quote override

Never allow the client to manipulate the final price.

---

# MODULE 7 — MEASUREMENT SYSTEM

Status: [x] COMPLETE

Build:

- measurement profiles
- measurement form
- measurement categories
- measurement units
- validation
- save/update measurements
- multiple saved profiles
- measurement guide
- images
- video support
- order-linked measurements

Admin:

- view customer measurements
- request correction
- approve measurement profile
- attach measurement version to order

---

# MODULE 8 — INSPIRATION UPLOAD & MEDIA MANAGEMENT

Status: [x] COMPLETE

Build:

- inspiration image upload
- multiple images
- file validation
- image compression where practical
- Supabase Storage
- secure access
- image preview
- delete
- associate with builder configuration/enquiry/order

Admin media library foundation.

---

# MODULE 9 — ENQUIRIES, CONSULTATIONS & CONTACT

Status: [x] COMPLETE

Implement:

- enquiry form
- consultation booking
- consultation types
- date/time selection
- customer notes
- WhatsApp CTA
- live chat integration abstraction
- enquiry status
- admin enquiry management

Development mode should not require paid WhatsApp/chat services.

---

# MODULE 10 — CART, CHECKOUT & QUOTATION FLOW

Status: [x] COMPLETE

Build:

- cart
- cart items
- custom configuration cart items
- checkout
- customer details
- shipping address
- measurement selection
- quotation confirmation
- admin quote workflow

Support:

`Enquiry → Quote → Customer Approval → Order`

and normal product checkout where appropriate.

---

# MODULE 11 — PAYMENT SYSTEM

Status: [x] COMPLETE

(Stripe test mode is the implemented provider — Apple Pay/Google Pay are surfaced automatically by
Stripe Checkout with no extra work. PayPal: the `PaymentProvider` interface architecturally
supports a second provider dropping in the same way Stripe does, but no PayPal implementation was
written — no sandbox credentials were provided, matching the free-first default used elsewhere in
this project. Manual/offline payment collection is the always-available fallback when no provider
is configured.)

Create payment abstraction.

Support architecture for:

- Stripe
- PayPal
- Apple Pay where supported by provider
- Google Pay where supported by provider

Development:

- Stripe test mode
- PayPal sandbox

Business logic:

- deposit
- remaining balance
- full payment
- payment status
- refunds
- payment history
- receipts

Never expose secret payment keys.

---

# MODULE 12 — ORDER MANAGEMENT

Status: [x] COMPLETE

(Production/shipping status display is read-only here, reading tables that already existed from
Module 1's schema pass — Module 13 owns the actual production pipeline UI and Module 14 owns
shipping/tracking. "Production handoff" is scoped to creating the initial `production_orders` row
only, nothing beyond it. Status transitions are unrestricted for now — a real state machine is
explicitly Module 13's job. "Notifications"/"customer communication" use the existing `notifications`
table in-app only; the full multi-channel notification engine is Module 15's.)

Customer:

- order history
- order detail
- order timeline
- payment status
- production status
- shipping status
- estimated completion
- notifications

Admin:

- order management
- status changes
- notes
- customer communication
- payment overview
- production handoff

---

# MODULE 13 — PRODUCTION WORKFLOW

Status: [x] COMPLETE

(The 12-stage enum is fixed, not admin-customizable — "allow admin to customize statuses later"
stays a deferred stretch goal, matching the plan's own wording. Production staff access is scoped
to the 'production' role only, not 'staff', per explicit instruction — a narrow, additive RLS
change just for this module's own need, not Module 26's general per-role permission system.)

Model Pakistan production workflow.

Example statuses:

1. Order Confirmed
2. Measurements Verified
3. Design Approved
4. Materials Prepared
5. Cutting
6. Embroidery
7. Stitching
8. Finishing
9. Quality Check
10. Ready for Dispatch
11. Shipped
12. Delivered

Allow admin to customize statuses later.

Production staff should have limited access.

Create status history.

---

# MODULE 14 — SHIPPING & TRACKING

Status: [x] COMPLETE

(Mock rates are a flat UK-vs-international rule, not a real rates engine; a real courier API is
architecturally supported by the ShippingProvider interface but not implemented, same deferral as
Module 11's PayPal decision. shipping_cost is recorded for admin visibility only, never charged to
the customer — Modules 10/11 already finalized order totals with no shipping line item. No
dedicated "customer tracking page" route — shipping_events was folded into the existing merged
order timeline on /account/orders/[id] instead, the same move Module 13 made for production.)

Build shipping abstraction.

Development:

- mock shipping rates
- mock tracking

Support future:

- UK shipping
- international shipping
- courier API
- tracking numbers
- shipping events
- delivery status
- shipping cost rules

Customer tracking page.

---

# MODULE 15 — NOTIFICATIONS & AUTOMATION ENGINE

Status: [x] COMPLETE

(Templates are plain TS functions, not a DB-editable table — not asked for, and notification
preferences/UI polish belong to Module 27, Customer Notification Center. Email/WhatsApp are mocked
(logged, not sent) — no real provider credentials exist, same deferral as Modules 11/14's PayPal/
courier decisions. SMS is entirely unbuilt, per the plan's own "SMS later." The review-request
notification fires immediately alongside "delivered" rather than after a delay — no scheduler
exists anywhere in this stack.)

Create notification architecture.

Channels:

- email
- WhatsApp
- in-app
- SMS later

Events:

- account created
- enquiry received
- quote created
- quote approved
- order confirmed
- deposit paid
- production started
- production status changed
- QC complete
- shipped
- delivered
- balance due
- review request

Create notification templates.

For development, use mock/local notification providers.

---

# MODULE 16 — ADMIN DASHBOARD FOUNDATION

Status: [x] COMPLETE

(Nav items explicitly owned by a later module — Builder/Inventory [17], Reviews [18], Marketing
[19], Content/SEO [20], Analytics section [21], Settings [25] — get a ComingSoon placeholder
naming that module, not new functionality, so they aren't rebuilt when their real module lands.
Customers and Quotations had no owning module and no schema gap, so both got real pages now, per
explicit approval. The dashboard's own "analytics" widget is a small built-in week-over-week order
comparison, not a charting library — the full Analytics section stays deferred to Module 21.)

Build premium responsive admin dashboard.

Dashboard:

- revenue
- orders
- customers
- pending enquiries
- active production
- pending payments
- shipping
- reviews
- analytics

Navigation:

- Dashboard
- Orders
- Customers
- Products
- Collections
- Builder
- Measurements
- Enquiries
- Quotations
- Appointments
- Production
- Payments
- Shipping
- Inventory
- Reviews
- Marketing
- Content
- SEO
- Analytics
- Settings

---

# MODULE 17 — ADMIN PRODUCT, BUILDER & INVENTORY MANAGEMENT

Status: [x] COMPLETE

(Builder pricing is editing price_adjustment on the six existing option tables, not a separate
pricing engine — compute_builder_estimated_price already reads it live. Product images reuse
Module 8's media library as a picker rather than a new Storage bucket, per its own flagged
fast-follow. Inventory is one generic table [fabric/material/embroidery_material via a category
column], not three; reserved_quantity stays admin-edited only, by explicit approval — no
bill-of-materials system. No staff/production RLS carve-out for inventory — that gap stays
deferred to Module 26 project-wide. CLOSED in Module 26: 0054 grants inventory_items to
inventory.write, which the production role holds.)

Admin can manage:

- products
- collections
- categories
- fabrics
- colours
- embroidery
- sleeves
- necklines
- dupattas
- builder pricing
- product images
- inventory

Inventory should be designed to support:

- fabrics
- materials
- embroidery materials
- stock quantity
- reserved quantity
- low stock
- availability

---

# MODULE 18 — REVIEWS, TESTIMONIALS & SOCIAL PROOF

Status: [x] COMPLETE

(Found and fixed a real RLS gap along the way: reviews' own UPDATE policy let the author
self-publish/self-feature their own review, undermining "admin moderation required" — closed via a
security-invoker trigger, same shape as Module 2's profiles.role self-promotion fix. reviewer_name
is a customer-chosen snapshot captured at submission, not a live profiles join — a deliberate,
approved reversal of the prior "generic Verified Customer" decision. Verified-purchase is
order_id !== null, validated server-side at submission rather than re-derived via a live join.
Video testimonials are external link references, not uploads — no bucket anywhere accepts video.
Instagram gallery is admin-curated via social_gallery_images today, same mock-then-swap shape as
every other provider abstraction in this project. No hard delete for reviews, matching the missing
RLS delete policy's own signal.)

Implement:

- customer reviews
- rating
- review moderation
- photo testimonials
- video testimonial references
- verified purchase badge
- featured reviews
- Instagram gallery integration abstraction

Admin moderation required.

---

# MODULE 19 — MARKETING & CUSTOMER RETENTION

Status: [x] COMPLETE

(Built in two passes by explicit agreement. Pass 1: coupons/discounts, loyalty points, referral
program — the checkout/payment-linked features. Pass 2: customer segments, campaigns, newsletter
unsubscribe, promotional banners, and the abandoned-cart cron job. Both passes verified live and
committed separately.

Approved scope calls: referral completion is admin-triggered, not automatic on the referred
customer's first order, avoiding a new hook into placeOrder for a low-frequency feature; customer
segments are computed tags derived at read time from existing order/profile data, not a persisted
membership table with a rule builder; and the new scheduled promotional_banners table replaces
Module 3's single site_settings announcement toggle rather than sitting alongside it.

Note: the abandoned-cart job deliberately keys off cart_items.updated_at, not carts.updated_at —
the latter is bumped on every page view site-wide by get_or_create_cart and is therefore useless as
an abandonment signal. See docs/ARCHITECTURE.md. This module also introduces the project's first
scheduled task (vercel.json + Vercel Cron), which requires CRON_SECRET to be set before any real
deploy.)

Implement architecture for:

- coupons
- discounts
- abandoned cart
- referral program
- loyalty points
- customer segments
- campaigns
- newsletter
- promotional banners

Free development implementation first.

Paid email/SMS platforms can be connected later.

---

# MODULE 20 — SEO & CONTENT MANAGEMENT

Status: [x] COMPLETE

(Delivered in two passes by explicit agreement. Pass 1: metadata/dynamic metadata, Open Graph,
Twitter cards, canonical URLs, sitemap, robots.txt, Product/Organization/WebSite/Breadcrumb
structured data, and the visible breadcrumb trail. Pass 2: blog, root-level CMS pages, FAQs +
FAQPage schema, BlogPosting schema, the admin SEO and Content screens, storefront image
optimization, footer internal linking, and `docs/SEO.md` covering Google Search Console.

Three scope calls agreed with the owner: CMS pages get root-level URLs (`/about`, `/faq`) rather
than a `/pages/` prefix; the `next/image` conversion covers public storefront components only —
admin/account UI stays with Module 28, which owns performance; and page/post body content renders
as plain text rather than HTML/markdown, because rendering stored HTML would make the content
editor a stored-XSS vector and adding a markdown renderer plus sanitizer is a dependency decision
for its own module.

Fixed along the way: the missing-`<title>` bug documented during Module 19, and a site-wide
**soft 404** — every unknown URL returned HTTP 200 with not-found content, extending the Module 10
follow-up pass's middleware approach to `/blog/[slug]` and the root CMS `[slug]`.

⚠️ **`seo.indexing_enabled` defaults to FALSE.** The site is deliberately un-indexable — robots.txt
blocks everything and every page sends `noindex` — until the owner ticks "Allow search engines to
index this site" in Admin → SEO. **This must be turned on at launch.** See `docs/SEO.md`.)

Implement:

- metadata
- dynamic metadata
- Open Graph
- Twitter/X cards
- canonical URLs
- sitemap
- robots.txt
- structured data
- Product schema
- Organization schema
- Breadcrumb schema
- FAQ schema
- image optimization
- alt text
- blog
- CMS pages
- internal linking

Admin SEO fields.

Google Search Console integration documentation.

---

# MODULE 21 — ANALYTICS & TRACKING

Status: [x] COMPLETE

(Provider abstraction in `lib/analytics/` following the `lib/social`/`lib/shipping` shape, writing
to `analytics_events` — a Module 1 table that had never been used. All 13 events instrumented.
GA4/Meta/TikTok pixels wired but unset by default, so nothing third-party loads. Admin → Analytics
gives a session-based conversion funnel plus per-step trends; the Dashboard keeps the business
figures.

Consent: three granular categories (Necessary / Analytics / Marketing), opt-in, with equal-weight
Accept/Reject, nothing pre-ticked, and withdrawal via a footer link on every page. The gate lives
inside `trackServer()` rather than at each call site, so a future action cannot forget it. Raw
events auto-purge after 14 months via a monthly cron.

One deliberate carve-out, stated plainly: `purchase`/`payment_completed` are recorded without
consent but with `session_id = null` — they restate facts already in `orders`/`payments` and store
nothing on the device. The funnel counts distinct sessions, so they can never distort a conversion
rate.

⚠️ **Before launch:** create the `/privacy` CMS page the consent banner links to (Admin → Content),
and ensure `CRON_SECRET` is set — `/api/cron/purge-analytics` deletes data. See `docs/ANALYTICS.md`.)

Create analytics abstraction.

Events:

- page view
- product view
- builder started
- builder completed
- inspiration uploaded
- enquiry submitted
- consultation booked
- add to cart
- checkout started
- payment started
- payment completed
- purchase
- wishlist action

Prepare:

- Google Analytics
- Meta Pixel
- TikTok Pixel

All tracking must respect privacy/consent requirements.

---

# MODULE 22 — AI FOUNDATION

Status: [x] COMPLETE

(Provider abstraction in `lib/ai/` following the `lib/payments` shape: a real Claude provider
(`@anthropic-ai/sdk`, `claude-opus-5`) alongside a deterministic engine that is the DEFAULT and runs
with zero configuration. No key means the free engine, and the whole app works that way — the same
`isStripeConfigured()` pattern from Module 11. Every Claude method falls back to the deterministic
one on error, refusal or timeout, so an AI outage degrades quality and never availability.

The five hard rules are enforced two ways, and the split is the design. "Never alter payment
records / order status / bypass admin controls" is STRUCTURAL: the `AiProvider` interface exposes
four narrow capabilities and no general `complete()`, so no call path to a write exists. "Never
invent prices / promise delivery dates" is enforced by `guardrails.ts`, which runs over EVERY
provider's output — including the deterministic one — redacting all monetary amounts, all delivery
timescales and all order/payment status claims. Both admin surfaces are draft-and-review: AI fills
a form field, the admin edits and saves through the existing validated action.

Scope call agreed with the owner: this module ships the engine plus the two ADMIN surfaces no later
module owns (Generate product description, Draft customer email). The customer chatbot and
storefront recommendation UI stay with Module 23; the email template library stays with Module 24.

Recommendations are rules-based and never call a model — ranking by co-view/co-purchase counts is
arithmetic. Affinity is computed product-to-product, never per-visitor, keeping it inside the
purpose disclosed in Module 21's consent banner.

⚠️ **The Claude happy path is UNVERIFIED** — no `ANTHROPIC_API_KEY` was available. Request shapes
follow current SDK docs and all fallback paths are tested, but no successful live response has been
observed. Test with a real key before relying on it. See `docs/AI.md`.)

Create provider-independent AI architecture.

Features:

- FAQ chatbot
- product recommendations
- AI product descriptions
- AI email drafts
- customer assistance

Development fallback:

- deterministic FAQ engine
- rules-based recommendations
- mock AI provider

AI must never:

- invent final prices
- promise delivery dates
- alter payment records
- alter order status
- bypass admin controls

---

# MODULE 23 — CUSTOMER CHATBOT & RECOMMENDATION SYSTEM

Status: [x] COMPLETE

(The customer assistant now replaces Module 9's mock chat widget as the default `CHAT_PROVIDER`,
using the seam that module built — `CHAT_PROVIDER=mock` still reverts to the enquiry form.

Central design decision: **the AI never writes the product list, it only parses the question into
filters.** `interpretQuery` returns a fixed structured intent that drives ordinary SQL, so customers
see real database rows as product cards. Module 22's narrow-interface guarantee therefore survives
intact — still no general `complete()`, still no write path. The Claude implementation also
re-validates its own output against the real catalogue before any value becomes a filter.

Scope calls agreed with the owner: added a real **occasions taxonomy** (0048, admin-managed, seeded
with bridal/mehndi/walima/reception/engagement/party and default builder-option links); implemented
**real `?q=` search**, which fixes a defect from Module 20 where the WebSite JSON-LD advertised a
`SearchAction` at `/products?q=` that did not exist; added **rate limiting** — the first in the
project — because with an API key set every chat message costs money; and seeded **12 starter FAQs**
so the assistant is demonstrable rather than answering "I don't know" to everything.

The assistant records every question it could not answer and surfaces them in Admin → Content as a
FAQ backlog — the questions customers actually ask, written by customers, ready to be turned into
FAQs.

⚠️ Claude's happy path remains **unverified** (still no `ANTHROPIC_API_KEY`); the deterministic
engine is fully tested and is what runs by default. See `docs/AI.md`.)

Implement:

- FAQ chatbot
- product discovery
- style recommendations
- occasion recommendations
- colour suggestions
- fabric suggestions
- builder guidance

Use a safe knowledge source.

AI responses must be clearly constrained by business data.

---

# MODULE 24 — EMAIL & AUTOMATION TEMPLATES

Status: [x] COMPLETE

(Module 15 had already written 16 template bodies and the notify() dispatcher, so the real gap was
everything around them: no provider abstraction (email was a `logger.info` call), no HTML, no
welcome email, and no record of what was sent.

All 12 required template kinds now render branded HTML plus a plain-text alternative through one
shared layout, using the logo and brand name from site settings. `notify()` was NOT rewritten — its
shape is unchanged, so none of its ~16 call sites were touched; it simply renders through
`lib/email` now, and `lib/notifications/templates.ts` remains the single source of copy for both the
in-app feed and the email.

Provider: mock by default (logs, costs nothing, works offline), with a real Resend implementation
using plain `fetch` — no SDK, no new dependency — that activates only when RESEND_API_KEY and
EMAIL_FROM are both set. Every send is recorded in `email_deliveries` (admin-only), so a failure is
a row rather than a log line that scrolled away.

**Marketing and transactional are different TYPES, not a convention.** A marketing message requires
an unsubscribe URL to be constructed at all, and the marketing layout injects the link itself — so a
future campaign feature cannot omit it. Transactional email deliberately carries none: opting out of
marketing is not opting out of knowing where your order is.

⚠️ **Three compliance defects in Module 19 found and fixed here:** campaign emails carried NO
unsubscribe link; customer-segment campaigns (VIP/new/at-risk) applied NO opt-out check at all,
because `profiles` had no such column; and the recipient lookup silently stopped at 200 users. UK
PECR requires a working opt-out on every marketing email. Customers now have the same opt-out
mechanism subscribers already had, honoured on every target, with the lookup failing closed.

Claude's and Resend's live paths both remain unverified (no credentials available); the mock path is
fully tested and is what runs by default. See `docs/EMAIL.md`.)

Create reusable templates for:

- welcome
- enquiry confirmation
- quotation
- order confirmation
- deposit confirmation
- production update
- shipping update
- balance reminder
- delivery
- review request
- abandoned cart
- promotional campaigns

Create provider abstraction.

---

# MODULE 25 — ADMIN SETTINGS & BUSINESS CONFIGURATION

Status: [x] COMPLETE

(Delivered in two passes. All ten sections ship: General, Theme, Store, Orders, Builder, Shipping,
Notifications, SEO, Analytics and AI, driven by a declarative registry so adding a setting is one
entry rather than four edits that can drift apart.

TWO RULES ENFORCED THROUGHOUT. Secrets never enter the database - Stripe, Claude, Resend and the
cron secret stay in environment variables and the screen reports only configured/not-set, never a
value; a credential in a row every admin can read would be a real security regression. And every
field ships wired to visible behaviour: a setting that stores a value but does nothing is worse
than no setting, which is why shipping rate tables were deferred rather than added as inert inputs.

New business logic, both defaulting to OFF so upgrading changes nothing: a configurable tax rate
(inclusive or exclusive) applied after discounts and disclosed on the checkout summary, and a
deposit percentage for cart checkout that creates a deposit payment with the balance due before
shipping. Correction to the plan's assumption: orders.deposit_amount already existed and the
quotation flow already created deposit payments - only the cart path lacked a rule, so this needed
one new column rather than two.

Also wired: currency and locale replacing hardcoded GBP/en-GB across the storefront, theme CSS
variables extended to background/text/radius, typography as preloaded font presets (fonts resolve
at build time, so a free-text font name would silently do nothing), analytics tracking IDs moved
out of build-time env vars, and feature toggles for the assistant, admin drafting, the builder and
both email streams - each enforced server-side rather than by hiding UI.

WARNING: Shipping rate tables (zones, weights, per-country rates) are NOT built and the screen says
so. Tax is a single flat rate, not per-product VAT classes. Order/production statuses stay
code-owned. See docs/SETTINGS.md.)

Admin Settings must become the control center.

Sections:

### General

- brand name
- logo
- contact
- currency
- country
- timezone

### Theme

- colors
- typography
- buttons
- radius
- layout settings

### Store

- products
- pricing
- taxes
- coupons

### Builder

- options
- pricing
- required fields
- availability

### Orders

- order statuses
- production statuses
- deposit rules

### Shipping

- countries
- rates
- courier settings

### Notifications

- email
- WhatsApp
- templates

### SEO

- defaults
- social sharing
- indexing

### Analytics

- tracking IDs

### AI

- provider configuration
- feature toggles

Use feature flags.

---

# MODULE 26 — ADMIN ROLES & PERMISSIONS

Status: [x] COMPLETE

Built in two passes. Nine roles and 23 permissions in `role_permissions`, resolved through one
`has_permission()` function that RLS, the middleware route guard, `requirePermission()` in Server
Actions and the sidebar filter all consult. Admin -> Team (`/admin/team`, behind `roles.manage`)
assigns roles and edits the matrix. Full detail in `docs/PERMISSIONS.md`.

"Never rely only on hiding UI buttons" is honoured literally: the sidebar filter is documented as
cosmetic in the code itself, and enforcement is RLS first, then the route guard, then the action
guard.

The design constraint was that 151 existing RLS policies call `is_admin()`, so migrations `0054`
and `0055` only ADD policies. PERMISSIVE policies are OR'd, so an addition cannot narrow anyone's
access, and `scripts/snapshot-policies.mjs --diff` proves it mechanically: 173 -> 260 policies,
87 added, 0 removed, 0 changed. `scripts/run-suite.mjs --diff` held every pre-existing script to
identical counts, and `scripts/test-permissions.mjs` adds 125 checks whose negative half is the
substantive half.

Two deliberate behaviour changes: `is_admin()` widened to include `super_admin`, and role
assignment narrowed from "any admin" to `has_permission('roles.manage')` — a plain `admin` can no
longer change anyone's role. Existing admins were promoted to `super_admin` by `0053`.

The negative testing found a real over-grant: `0054` gave `production` a blanket `orders.read`,
undoing Module 13's handed-off-only rule. `0055` removed the permission rather than weakening the
policy.

Implement granular permissions.

Example:

- Super Admin
- Admin
- Sales
- Production
- QC
- Finance
- Customer Support
- Marketing

Each role must have explicit permissions.

Never rely only on hiding UI buttons.

Permissions must be enforced server-side/RLS.

---

# MODULE 27 — CUSTOMER NOTIFICATION CENTER

Status: [x] COMPLETE

Built in two passes. Notifications now carry a category and a deep link,
derived inside notify() from the `type` its 18 call sites already pass, so
none of them changed. The centre has category filters, unread-only, mark
all/one read and unread, pagination, and an unread badge in the account nav
and site header. Per-category EMAIL preferences via notification_preferences
and wants_email(); the in-app feed is deliberately NOT suppressible — it is
the customer's record of what happened. Marketing stays on the existing
profiles.marketing_opt_out rather than becoming a second source of truth.

Pass 2 adds /api/cron/reminders (daily): outstanding balances and
consultations in the next 48 hours, with a notification_reminders ledger
whose primary key makes a double-send impossible rather than merely
unlikely. Guests are reminded too, by the contact_email 0028 added.

Verification: policies 260 -> 262, additive only. All pre-existing scripts
held to identical counts. test-notification-center.mjs 54/0,
test-reminders.mjs 27/0 (1 skip: CRON_SECRET unset locally).

Four real bugs found by the negative half of the tests: unstable pagination
(created_at ties reshuffle between pages), notify() silencing WhatsApp when
order emails were switched off, guest appointments being skipped entirely,
and /forgot-password reporting success when Supabase's SMTP rate limit meant
nothing was sent. Full detail in docs/NOTIFICATIONS.md.

Customer dashboard notification center:

- unread count
- notifications
- order updates
- payment reminders
- consultation reminders
- production updates

Support notification preferences.

---

# MODULE 28 — PERFORMANCE, ACCESSIBILITY & RESPONSIVENESS

Status: [x] COMPLETE

Built in two passes, with three new checks that re-run on every suite pass:
test-contrast.mjs (41/0), test-a11y.mjs (147/0), test-bundle-budget.mjs (13/0).

LIGHTHOUSE WAS NOT RUN and no score is claimed — Chromium is not installed
in this environment, and a localhost run would not transfer to production
anyway. Everything on the audit list that can be decided deterministically
is; field Core Web Vitals remain genuinely unverified and need a deploy.

Pass 1 found five real contrast failures (the light focus ring at 2.37:1
being the worst — the one affordance a keyboard user cannot do without),
two layouts with no <main> landmark at all, seven pages shipping no <h1>,
two hover-only buttons invisible while focused, and two overlays with no
Escape, dialog semantics or focus return.

Pass 2 removed framer-motion entirely — a 5.4 MB dependency used for a
fade, a scroll reveal and a hero stagger, all of which are CSS. Home went
173 -> 129 kB and /products/[slug] 180 -> 140 kB. The hero <h1> now
animates transform only, because an element at opacity 0 has not painted
and the old fade was pushing LCP out by its own duration on the site's
most important route.

Cross-request catalogue caching was deliberately NOT implemented; the
reasoning is recorded in docs/PERFORMANCE-A11Y.md rather than left as an
unexplained gap. A full focus trap in useDialog is a stated remaining gap.

Verification: policies 262 -> 262, zero changes. All pre-existing scripts
held to identical counts across both passes.

Audit:

- mobile
- tablet
- desktop
- keyboard navigation
- screen readers
- color contrast
- reduced motion
- image optimization
- lazy loading
- caching
- bundle size
- Core Web Vitals

Target excellent Lighthouse scores where realistically achievable.

---

# MODULE 29 — SECURITY AUDIT

Status: [x] COMPLETE

The audit is scripts/test-security.mjs (42 checks), which re-runs with the
suite — an audit whose output is prose decays the moment someone changes a
file. NO CRITICAL FINDINGS. Twelve issues found, all closed.

Verified already correct: secret hygiene (all 150 built client bundles
scanned — no service-role key, Stripe secret or DATABASE_URL), all 16
createAdminClient() call sites guarded, Stripe signature verification,
price integrity, cross-user isolation, and both dangerouslySetInnerHTML
uses.

Fixed: three cron routes were publicly callable because a missing
CRON_SECRET meant "skip the check" — they now FAIL CLOSED in production
(503). audit_logs had existed since 0012 with nothing writing to it;
logAudit() now records refunds, order status changes, role assignment and
settings. Rate limiting added to the contact, consultation and newsletter
forms. Security headers added, with CSP shipped REPORT-ONLY pending real
traffic. reap_stale_carts() reaps ownerless empty carts — 989 had
accumulated from page views alone; a guest cart WITH items is never
touched, and the audit asserts both directions.

Known limitations recorded in docs/SECURITY.md rather than left implicit:
end-to-end price integrity is asserted at source level not behaviourally,
rate limiting is per-source not distributed, CSP is not yet enforced, and
no external scanning was performed.

Perform security review:

- authentication
- authorization
- RLS
- API routes
- server actions
- file uploads
- webhooks
- payments
- admin access
- environment variables
- XSS
- CSRF considerations
- injection
- rate limiting
- abuse prevention
- audit logs

---

# MODULE 30 — TESTING & QUALITY ASSURANCE

Status: [x] COMPLETE

Suite: 40 scripts, 1353 pass / 0 fail. No test framework added — unit
tests use Node's built-in node:test, so devDependencies are unchanged.
Component tests and Playwright were deliberately skipped, decided with the
owner and recorded in docs/TESTING.md rather than left as silent gaps.

scripts/test-flows-coverage.mjs names, per critical flow, a SPECIFIC
script and SPECIFIC assertion strings. Keyword-grepping was worse than
useless here: "order" appears in 25 scripts almost entirely incidentally,
so a naive matrix reports near-total coverage regardless of reality.

It found two genuine gaps and one of its own errors. REGISTRATION was
never tested — zero of the 34 scripts called signUp(), because Supabase's
public signUp rejects the .local test domain that admin.createUser
accepts, which is very likely why the path went untested for 29 modules.
PRODUCT BROWSING was covered only incidentally. And DEPOSIT was pointed at
test-payments.mjs, which only ever uses type: "full" — the deposit rules
actually live in test-settings-pass2.mjs.

Also found: the storefront product listing has NO pagination and no
user-controlled sort. Reported by test-browsing.mjs rather than tested,
because testing a feature that does not exist is how a coverage matrix
starts lying.

Registration's signUp assertions record SKIP when Supabase's ~2/hour mail
limit is hit — not a pass and not a failure. Resolves when custom SMTP is
configured, already a standing launch blocker.

Verification: policies 262 -> 262 zero changes; all 36 pre-existing
scripts held to identical counts.

Implement testing strategy.

Include:

- unit tests
- component tests
- integration tests
- database/RLS tests
- critical end-to-end tests

Critical flows:

1. Registration
2. Login
3. Product browsing
4. Builder
5. Inspiration upload
6. Measurements
7. Enquiry
8. Quote
9. Checkout
10. Deposit
11. Order
12. Production
13. Shipping
14. Delivery
15. Review

---

# MODULE 31 — SEED DATA & DEMO STORE

Status: [x] COMPLETE

scripts/seed-demo.mjs with --seed / --status / --clear. 12 products, 4
collections, 8 testimonials (with the demo customer accounts reviews
requires), 4 blog posts, 4 CMS pages, 6 gallery images and a generated
image for each — 59 tracked rows.

A SCRIPT, NOT A MIGRATION. Every other seed here is a migration, which is
right for reference data, but demo products must be removable before
launch and a migration that inserts them is either permanent or needs a
second migration to undo.

--clear IS SAFE because everything created is recorded in demo_seed_items
(0060), so a real product has no manifest entry and is never a candidate
for deletion at all. test-seed-demo.mjs asserts this directly: it plants a
hand-made product, page and account alongside the demo data, runs --clear,
and checks all three survive.

IMAGES ARE GENERATED LOCALLY and had to be. Module 28 restricted
next/image to the Supabase host and Module 29's CSP restricted img-src to
the same, so an Unsplash or picsum URL would break the storefront twice
over. scripts/lib/placeholder-image.mjs writes PNGs with no dependencies
(zlib plus CRC framing), deterministic per slug, in the brand palette.
Not SVG: validate-file.ts rejects it as a stored-XSS vector and next/image
will not optimise it. This also settles the plan's copyright rule outright
— nothing is derived from anyone's work.

/privacy NOW EXISTS, closing half a launch blocker open since Module 21:
the cookie banner and chat widget have linked to it all along. THE LEGAL
TEXT IS A DRAFT and says so on its face; it names the data this app
actually collects, but it needs a solicitor before launch. The blocker
moves from "the link 404s" to "the policy needs review" — progress, not
completion.

IMAGE SOURCING, REVISED AFTER THE FACT. The generated gradients were
replaced with real bridal photography at the owner's request.

Unsplash was asked for first and could not be used: api.unsplash.com
returns 401 without a registered application's Access Key, and the old
keyless source.unsplash.com endpoint is retired (503). Outbound HTTPS
works, so this was a credential blocker rather than a network one. The
owner supplied a Pexels key instead; both licences permit commercial use,
and the practical difference is only which one we have credentials for.

THE CONSTRAINT THAT SHAPED THE IMPLEMENTATION: images are downloaded,
validated and RE-HOSTED on Supabase Storage — never hotlinked. Module 28
set next.config.mjs remotePatterns to the Supabase host only, so
next/image THROWS on any other host and takes the page down rather than
just the image; Module 29's CSP restricts img-src to the same. An
external URL would break the storefront twice over. Verified after the
fact: zero images.pexels.com URLs appear in the rendered HTML.

Each photograph also gets a `media` row, so it appears in the admin Media
Library exactly as an admin upload would. That is the same path
uploadMedia() takes (uploadToStorage plus a media row) rather than a call
to the Server Action itself, which would need a signed-in admin session
and produce an identical result.

12 products, 12 photographs, drawn from six different search queries so
the catalogue does not look like the same photograph twelve times.
Attribution is stored in alt_text even though the Pexels licence does not
require it. THE LICENCE GRANTS NO MODEL OR PROPERTY RELEASES — fine for
demo data, and a real decision before these become the imagery of a live
shop selling garments that are not the ones photographed.

Three bugs surfaced while wiring this up, all fixed: seed-demo.mjs --seed
was clobbering photographs with gradients on every re-run; --clear treated
the photos/ subfolder as a file and left twelve orphaned objects in
storage (Supabase list() returns only direct children); and --clear never
deleted the media rows, so the manifest never drained. A fourth was in the
test rather than the code — it asserted PNG, which was right for gradients
and wrong the moment JPEGs arrived.

scripts/seed-demo-photos.mjs --fetch / --status / --revert. Requires
PEXELS_API_KEY in .env.local, which is gitignored and never committed.

A REAL FINDING, exposed by the demo data: test-ai.mjs's "co-viewed product
now appears" was passing for the wrong reason. getCoViewAffinity reads
analytics_events through the RLS client and an anonymous visitor cannot
read that table, so the behavioural recommendation tier NEVER runs on the
storefront — recommendations.ts documents this and calls it correct. The
assertion only passed because the catalog fallback had nothing else to
return in a near-empty shop. Corrected to assert what actually holds.

Create professional demo data.

Examples:

- luxury lehenga products
- collections
- fabrics
- embroidery
- colours
- builder options
- testimonials
- FAQs
- blog posts

Use placeholder/demo images where necessary.

Do not use copyrighted brand assets without permission.

---

# MODULE 32 — PRODUCTION DEPLOYMENT

Status: [ ] NOT STARTED

Deploy to:

- Vercel
- Supabase

Configure:

- environment variables
- production database
- migrations
- storage
- domain configuration
- security settings
- caching
- error monitoring strategy

Free-tier development setup first.

## REQUIRED — separate Supabase projects for development and production

This is not optional and it is not a nice-to-have. Until it is done, every
local script run and every test-suite run happens against the database
that serves live customers.

**It has already caused an outage.** Running `scripts/run-suite.mjs` before
a deployment executed `test-seed-demo.mjs`, which exercises
`seed-demo.mjs --clear`, which deleted the Storage objects behind 50 of
53 product photographs. The database rows survived pointing at URLs that
returned HTTP 400, so the live storefront rendered broken images across
almost the whole catalogue. Recovery took a full re-upload of every
collection.

A stop-gap guard is in place — `scripts/lib/guard-destructive.mjs` refuses
any destructive seeder mode when the configured Supabase project is the
production one, unless `ALLOW_DESTRUCTIVE=1` is set explicitly, and
`test-seed-demo.mjs` skips rather than granting itself that permission.
That guard reduces the risk; it does not remove it. Anyone who sets the
variable out of habit is back where we started.

Note that the guard keys on the **Supabase project ref**, not on
`NEXT_PUBLIC_SITE_URL`. At the time of the outage `.env.local` held
`NEXT_PUBLIC_SITE_URL=http://localhost:3000` while pointing at the
production database — a site-URL check would have passed and the shop
would still have gone down.

Tasks:

- [ ] Create a second Supabase project for development and testing.
- [ ] Apply all migrations to it (`scripts/migrate.mjs`).
- [ ] Point `.env.local` at the DEV project. Production credentials live
      only in Vercel's environment variables, never in a local file.
- [ ] Set `PRODUCTION_SUPABASE_REF` so the guard keeps recognising the
      live project after the split.
- [ ] Seed the dev project with the demo store so the suite has content.
- [ ] Re-run the full suite against dev and confirm `test-seed-demo.mjs`
      runs properly instead of skipping.
- [ ] Document the two-project setup in `docs/ARCHITECTURE.md` and the
      README's Getting Started section.

## REQUIRED — environment variables actually set on Vercel

Found live and not yet fixed: `NEXT_PUBLIC_SITE_URL` is unset on the
deployment, so `src/lib/config/site.ts` falls back to
`http://localhost:3000`. The consequences are visible in production HTML:

- `<link rel="canonical">`, `og:url` and the Organization/WebSite
  structured data all point at `http://localhost:3000`
- password-reset and email-confirmation links are generated against
  localhost, so account recovery is broken for real users
- the sitemap and any absolute URL in an email are wrong

Tasks:

- [ ] Set `NEXT_PUBLIC_SITE_URL` to the real production origin in Vercel.
- [ ] Add `<origin>/auth/callback` to Supabase Auth's redirect allow-list.
- [ ] Audit every variable in `.env.example` against what Vercel actually
      has; a missing one fails silently rather than loudly.
- [ ] Re-check the rendered `<head>` on production for any remaining
      `localhost` reference before calling the module done.

---

# MODULE 33 — PRODUCTION READINESS & HANDOVER

Status: [ ] NOT STARTED

Create:

- deployment guide
- admin guide
- customer flow documentation
- architecture documentation
- environment variable documentation
- backup strategy
- database migration guide
- troubleshooting guide
- future paid-service migration guide

Final audit:

- functionality
- UX
- performance
- SEO
- security
- accessibility
- mobile responsiveness
- admin
- customer journey

---

# MODULE 34 — FUTURE AI VIRTUAL LEHENGA DESIGNER

Status: [ ] FUTURE PHASE

This is intentionally separated from the core platform.

Potential functionality:

1. Customer uploads photo.
2. Customer selects preferences.
3. AI suggests lehenga styles.
4. AI suggests colours.
5. AI suggests embroidery.
6. AI generates concept images.
7. Customer compares designs.
8. Customer saves preferred design.
9. Admin reviews.
10. Customer receives personalized quotation.

Important:

Do not make this a core dependency of the first production version.

The architecture should prepare for it without delaying the main commerce platform.

---

# MODULE 35 — FUTURE VIRTUAL TRY-ON / 3D EXPERIENCE

Status: [ ] FUTURE PHASE

Explore:

- virtual try-on
- image-based visualization
- 3D lehenga viewer
- fabric simulation
- design comparison

These features may require paid/high-compute AI services in production.

During initial development, build interfaces and provider abstractions only.

---

# 12B. MCP / AI APPLICATION CONTROL LAYER

Added after Module 31, on the developer's instruction, as a permanent part
of the platform architecture — not a side experiment. This section is the
source of truth for what MCP is here, what exists, what does not, and what
was decided and why.

## 12B.1 Purpose

An authorized administrator gives an instruction in natural language, and
an AI assistant carries it out inside this application through explicitly
defined, validated, authorized, audited tools.

> "Add a new bridal lehenga called Royal Rose."
> "Show me all pending custom orders."
> "Change the homepage announcement."

The AI decides WHICH approved tool to call and WITH WHAT ARGUMENTS. It
never decides what the database will accept. Every rule the admin UI
enforces is enforced identically on the MCP path, because both go through
the same application services.

## 12B.2 Architecture

```text
Admin (signed-in, real Supabase session)
        |
Admin AI Chat  (Module 42)  /  external MCP client
        |
Claude / AI assistant
        |
POST /api/mcp          <- JSON-RPC 2.0, MCP wire protocol
        |
MCP server (src/lib/mcp/server.ts)
        |
Tool registry  ->  tool definition (schema, kind, permission, risk)
        |
Zod validation  ->  authorization  ->  confirmation gate
        |
Application service (src/lib/<domain>/, src/features/<domain>/actions.ts)
        |
Supabase (RLS enforced AS THE CALLER)
        |
PostgreSQL / Storage
```

Two boundaries do the real work and neither is the AI's to cross:

1. **The registry.** A tool that is not registered cannot be called. There
   is no `execute_sql`, no shell, no filesystem, no arbitrary HTTP, no
   generic `query(table)`. The transport can only dispatch to a name that
   exists in the registry.
2. **RLS.** Tool handlers use the CALLER'S Supabase client, not the
   service-role client, so Postgres refuses anything the signed-in human
   could not have done through the admin UI. The service-role client is
   reachable from exactly two places on the MCP path — the audit write and
   the rate limiter — both of which already used it before MCP existed and
   neither of which takes AI-supplied input.

## 12B.3 Authentication (DECIDED)

**Decision: in-app HTTP endpoint carrying the existing Supabase session.**
Approved by the developer before implementation.

`/api/mcp` lives inside the Next.js application. Identity comes from the
Supabase auth cookie (browser) or an `Authorization: Bearer <access token>`
header (a client holding a real user access token). There is no MCP-specific
credential, no API key, no service account, and no second user store.

The consequence is the point: **the actor is a real human being with a real
role**, so `has_permission()`, `role_permissions` and all 262 RLS policies
apply unchanged, and the audit trail names a person rather than a shared
robot account.

Rejected alternatives, recorded so they are not re-proposed:

- *Local stdio server with a dedicated Supabase service account* — smallest
  attack surface, but it cannot power the in-dashboard Admin AI Chat that is
  the actual product goal, and every audit row would name the same shared
  account instead of the admin who asked.
- *Both transports at once* — correct eventually, twice the security surface
  to test in the foundation module. A stdio adapter over the same registry
  remains open for Module 43 if an external Claude client is wanted.

## 12B.4 Authorization

Server-side, always, and never by hiding a tool.

Every tool definition declares a `permission` from the existing 23-key
catalogue in `src/lib/auth/permissions.ts`. No new role and no new
permission key was invented for MCP — MCP is a second doorway to
capabilities the platform already models, so a new key would mean a
capability the admin UI cannot express.

Three checks run in order on every `tools/call`:

1. **Authenticated?** No session -> `UNAUTHORIZED`.
2. **Admin role?** A `customer` reaches no MCP tool at all -> `FORBIDDEN`.
3. **Holds the tool's permission?** Read from the DATABASE
   (`role_permissions`), not the code mirror -> `FORBIDDEN`.

`tools/list` is filtered by the same permissions, so an assistant acting
for a Production account is never even told that `payments_refund` exists.
That filtering is a **usability** measure, not the enforcement: step 3 runs
on the call regardless of what was listed, because a client can call a name
it was never shown.

Fails closed everywhere. A failed permission lookup reads as "refused".

## 12B.5 Read tools vs write tools

Every tool declares `kind: "read" | "write"`.

- **read** — retrieves. Never mutates. Not audited to `audit_logs` (the
  application log records the call; a read log would be a second copy of
  the database and nobody would read it).
- **write** — mutates application state. Always audited. May require
  confirmation.

The distinction is structural, not a naming convention: the dispatcher
routes on it, and a `read` tool that writes is a bug the registry test
cannot catch — which is why write access is additionally bounded by RLS
under the caller's own identity.

## 12B.6 Risk levels and the confirmation rule

Every tool declares `risk: "low" | "medium" | "high"`.

**high** means the action must not happen merely because the AI interpreted
a sentence. A high-risk call arrives WITHOUT confirmation and does not
execute; it returns a confirmation requirement describing exactly what
would change, including the number of affected records, plus a signed
`confirmationToken`. The caller must call again with that token to execute.

The token is an HMAC over the tool name, the canonical arguments and the
actor id, with a 5-minute TTL. It is stateless (no table) and it is bound to
all three, so a token cannot be replayed against different arguments, a
different tool, or by a different user. Confirming is therefore confirming
*that exact action*, not "yes" in the abstract.

High-risk by rule (implemented as each tool arrives):

- deleting or archiving products; bulk updates or bulk deletion
- deleting customer data; modifying sensitive customer information
- refunds; any change to payment status
- changing a final quotation, order totals, or cancelling an order
- changing production-critical information
- changing admin permissions or roles
- publishing major content changes

## 12B.7 Audit logging

Every write tool call is written to the existing `audit_logs` table through
`logAudit()` — the same table and the same helper the admin UI uses, so one
query answers "who changed this" regardless of which doorway was used.

Recorded: actor id, `action` as `mcp.<tool_name>`, entity type, entity id,
a redacted input summary, and the outcome. Failures are recorded too — a
log that only contains successes cannot answer "what did it try to do".

Never recorded: secrets, tokens, raw credentials, or customer personal data
beyond the identifiers already present in the entity columns.

Audit writes never throw, per the existing helper's contract.

## 12B.8 Error model

Tools return controlled errors from a fixed set, with a message safe to
show a human:

```text
UNAUTHORIZED  FORBIDDEN  NOT_FOUND  VALIDATION_ERROR  CONFLICT
BUSINESS_RULE_ERROR  CONFIRMATION_REQUIRED  RATE_LIMITED
INTEGRATION_ERROR  INTERNAL_ERROR
```

Stack traces, SQL text, Postgres error codes, table names, environment
variables and internal URLs never reach the AI or the user. They go to the
server log. An unrecognised exception becomes `INTERNAL_ERROR` with a
generic message — the mapping is deny-by-default, so a new failure mode
cannot leak by being unhandled.

Never report success for an operation that failed.

## 12B.9 Tool naming convention (DECIDED)

`<domain>_<action>`, lower snake case, domain first so tools sort into
groups: `products_list`, `products_get`, `products_update`,
`orders_update_status`, `production_update_status`,
`content_update_announcement`.

One convention, no mixing. A new tool that does not fit an existing domain
prefix needs a new domain folder, not a new naming style.

## 12B.10 Directory structure

Chosen after inspecting the existing tree; it follows the established
`src/lib/<domain>/` convention rather than the generic layout suggested in
the MCP instruction.

```text
src/lib/mcp/
  protocol.ts     MCP/JSON-RPC wire types and the protocol version
  errors.ts       McpError, the code catalogue, safe error mapping
  registry.ts     ToolDefinition, registration, lookup, permission filter
  context.ts      McpContext — the actor and their Supabase client
  auth.ts         actor resolution + the three authorization checks
  audit.ts        write-tool audit + redaction
  confirm.ts      HMAC confirmation tokens for high-risk actions
  result.ts       the structured result envelope
  server.ts       JSON-RPC dispatch (initialize, tools/list, tools/call)
  tools/
    index.ts      assembles the registry from the domain modules
    system.ts     system_ping, system_whoami, system_diagnostics
    <domain>.ts   one file per domain, added by its own module
src/app/api/mcp/route.ts
```

One file per domain. No single file containing every tool.

## 12B.11 Business-logic rule

MCP must NOT create a second business-logic system. Tools call the same
readers in `src/lib/<domain>/` and the same writers in
`src/features/<domain>/actions.ts` that the admin UI calls. Where a Server
Action's signature is `FormData`-shaped, the tool builds the FormData rather
than reimplementing the mutation — the validation, the business rules and
the revalidation must not be able to drift apart.

If a tool ever genuinely needs privileged access, it must be documented
here with the reason and confined to that one operation. As of Module 36 no
tool does.

## 12B.12 AI-generated content

Content that an AI drafted is marked as AI-generated and follows
draft -> review -> approve -> publish. Automatic publication of AI-written
copy is not permitted unless this plan is amended to allow it for a named
surface. AI-generated content is never presented as human-authored.

## 12B.13 Development workflow

Identical to every other module:

`Plan -> Implement -> Test -> Security test -> Document -> Update this plan
-> git add -> commit -> push -> verify -> mark COMPLETE`

An MCP module is not complete until its tools are tested for valid input,
invalid input, unauthenticated access, wrong-role access, business-rule
violations and failure handling — with the negative half carrying the
weight, as in Module 26.

## 12B.14 Known limitations (as of Module 36)

- Only the system tools exist. No domain tools yet; they arrive per module.
- No streaming, no MCP resources, no prompts, no sampling — `tools/*` only.
- Confirmation tokens are stateless, so a token is single-action but not
  single-USE: within its 5-minute TTL the same token could execute the same
  action twice. A replay ledger arrives with Module 38, where the first
  destructive tools do.
- The endpoint is session-bound, so an external MCP client must supply a
  real user access token. No stdio transport (see 12B.3).
- Rate limiting is per-actor and table-backed; it throttles a runaway loop,
  it is not a defence against a distributed attack.

## 12B.15 Not permitted, permanently

No `execute_sql`. No shell execution. No filesystem access. No arbitrary
HTTP. No unrestricted Supabase access. No exposure of the service-role key
to the browser or to any model. No tool that takes a table name as an
argument.

---

# 12C. PHASE 6 — MCP MODULE ROADMAP

Appended as Modules 36-43. Modules 0-35 are unchanged and unrenumbered;
document order is not build order, so Phase 6 may run before Modules 32-33.

---

# MODULE 36 — MCP FOUNDATION, TRANSPORT & TOOL REGISTRY

Status: [x] COMPLETE

Delivers the bridge itself and nothing that belongs to a later module.

- `/api/mcp` speaking JSON-RPC 2.0: `initialize`, `notifications/initialized`,
  `ping`, `tools/list`, `tools/call`.
- The tool registry, the `ToolDefinition` contract, and Zod -> JSON Schema
  generation so a tool's advertised schema and its validation cannot drift.
- Actor resolution and the three authorization checks (12B.4).
- The controlled error catalogue and safe mapping (12B.8).
- Write-tool audit logging with redaction (12B.7).
- HMAC confirmation tokens for high-risk actions (12B.6).
- Per-actor rate limiting, reusing `checkRateLimit` with an identity key.
- Three system tools proving the pipeline end to end: `system_ping`,
  `system_whoami`, `system_diagnostics`.

DELIBERATE SCOPE DEVIATION, recorded rather than done silently: the
questionnaire that authorised Phase 6 sketched authentication as a separate
module. It is implemented here instead, because an MCP endpoint that ships
before its authorization layer is a hole in production for the length of one
module. Module 37 therefore covers the read-tool surface rather than auth.

No migration. `audit_logs` (0012) and `chat_rate_limits` (0049) already
exist and are reused.

Tests: `scripts/test-mcp.mjs` — protocol, registry, validation, the
authorization matrix across real signed-in roles, and the negative security
set from 12B.13.

# MODULE 37 — MCP READ TOOLS

Status: [ ] NOT STARTED

Read-only tools over catalogue, orders, enquiries, production, customers and
builder options. Each gated by its existing permission key. No writes.

Expected: `products_list`, `products_get`, `collections_list`,
`collections_get`, `orders_list`, `orders_get`, `enquiries_list`,
`enquiries_get`, `customers_search`, `customers_get`,
`production_list`, `production_get`, plus the builder option readers.

# MODULE 38 — MCP WRITE TOOLS & CONFIRMATION WORKFLOW

Status: [ ] NOT STARTED

The first mutating tools, through the existing Server Actions:
`products_create`, `products_update`, `products_archive`,
`collections_create`, `collections_update`, and the builder option writers.
Adds the confirmation replay ledger noted in 12B.14.

# MODULE 39 — MCP ORDER & PRODUCTION TOOLS

Status: [ ] NOT STARTED

`orders_update_status`, `production_update_status`,
`production_update_qc_status`, `enquiries_update_status`. Status transitions
must go through the existing workflow validation — no tool may invent a
transition the application does not already permit. Payment status and
refunds stay out of MCP until explicitly authorised.

# MODULE 40 — MCP CONTENT & SEO TOOLS

Status: [ ] NOT STARTED

`content_get_homepage`, `content_update_announcement`, `seo_get_settings`,
`seo_update_settings`, `seo_update_product`, and AI drafting that obeys the
draft -> review -> approve -> publish rule in 12B.12.

# MODULE 41 — MCP ANALYTICS & REPORTING TOOLS

Status: [ ] NOT STARTED

`analytics_sales_summary`, `analytics_order_summary`,
`analytics_customer_summary`, `orders_pending_summary`. Aggregates only —
no tool returns a customer list as an analytics result.

# MODULE 42 — ADMIN AI CHAT INTERFACE

Status: [ ] NOT STARTED

The in-dashboard chat that drives the MCP tools, including the human
confirmation step for high-risk actions and a plain-language rendering of
tool results. Do not build before this module.

# MODULE 43 — MCP PRODUCTION HARDENING & OBSERVABILITY

Status: [ ] NOT STARTED

Tool-call metrics, authorization-failure visibility in Admin, an MCP section
in the security audit, load and abuse testing, and — if wanted — a stdio
adapter over the same registry for external Claude clients.

---

# 13. HOW EACH CLAUDE CODE CHAT MUST WORK

When the developer opens a new chat, they will say:

> Start Module X from the Master Build Plan.

Claude MUST follow this sequence.

## STEP 1 — Read the plan

Read this Master Build Plan first.

Then inspect the current repository.

Do not assume previous work exists.

---

## STEP 2 — Determine current state

Inspect:

- files
- package.json
- database migrations
- environment files
- routes
- components
- services
- documentation
- previous module status

Never overwrite existing correct work unnecessarily.

---

## STEP 3 — Create a module-specific implementation plan

Before coding, provide:

1. Module objective
2. Existing dependencies
3. Files to create
4. Files to modify
5. Database changes
6. UI changes
7. Security changes
8. Testing plan
9. Acceptance criteria

Then proceed with implementation.

---

## STEP 4 — Implement incrementally

Do not generate giant speculative files.

Implement logical pieces.

After each major area:

- inspect
- typecheck
- lint
- test
- fix errors

---

## STEP 5 — Verify

Run appropriate checks.

At minimum when applicable:

```bash
npm run lint
npm run build
```

If tests exist:

```bash
npm test
```

Also verify the actual user flow in the browser.

---

## STEP 6 — Documentation

Update relevant documentation.

If a technical decision changes the architecture, document:

- what changed
- why
- impact
- migration requirements

---

## STEP 7 — Mark module complete

Only mark a module complete when:

- implementation is working
- acceptance criteria pass
- build passes
- relevant tests pass
- security requirements are satisfied
- documentation is updated

Then update this file:

`[ ] NOT STARTED`

to:

`[x] COMPLETE`

---

# 14. MODULE COMPLETION FORMAT

At the end of each module, Claude should report:

```text
MODULE X — COMPLETE

Implemented:
- ...
- ...
- ...

Files created:
- ...

Files modified:
- ...

Database changes:
- ...

Security:
- ...

Testing:
- ...

Build:
- PASS

Known limitations:
- ...

Next recommended module:
- MODULE X+1
```

Do not claim completion if something remains broken.

---

# 15. HANDLING BLOCKERS

If a module depends on something from a future module:

- implement a clean interface/stub
- document the dependency
- do not duplicate architecture
- do not skip the module

If a paid service is required:

- create an abstraction
- use a free/mock implementation
- document production replacement

If requirements conflict:

1. Identify conflict.
2. Prefer this Master Plan.
3. Prefer security.
4. Prefer maintainability.
5. Do not silently choose a major architecture change.

---

# 16. GIT / VERSION CONTROL RULES

After meaningful milestones:

- inspect git diff
- ensure no secrets are committed
- create a clear commit

Suggested format:

```text
feat(module-X): implement ...
fix(module-X): ...
docs(module-X): ...
```

Never commit:

- `.env`
- secrets
- API keys
- service-role keys
- private credentials

Create `.env.example`.

---

# 17. ENVIRONMENT VARIABLES

Use environment variables for all external configuration.

Example categories:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY

STRIPE_SECRET_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

PAYPAL_CLIENT_ID
PAYPAL_CLIENT_SECRET

NEXT_PUBLIC_SITE_URL

ANALYTICS IDs
AI provider keys
EMAIL provider keys
SHIPPING provider keys
```

Only add variables when the corresponding module needs them.

Never expose server secrets through `NEXT_PUBLIC_*`.

---

# 18. ERROR HANDLING

Every important flow must have:

- loading state
- success state
- empty state
- error state
- retry mechanism where appropriate

User-facing errors should be understandable.

Developer errors should be logged securely.

Do not expose database errors or secrets to customers.

---

# 19. UI QUALITY STANDARD

Every page must be reviewed for:

### Desktop

- spacing
- alignment
- typography
- visual hierarchy
- navigation
- responsiveness

### Mobile

- touch targets
- navigation
- form usability
- builder usability
- image sizing
- checkout usability

### Accessibility

- keyboard navigation
- labels
- focus states
- semantic HTML
- contrast
- reduced motion

---

# 20. ANIMATION STANDARD

Use animation intentionally.

Recommended:

- fade
- slide
- scale
- image reveal
- hover transitions
- staggered content
- modal transitions
- page transitions

Avoid:

- excessive bouncing
- distracting motion
- animation on every element
- slow transitions
- layout-shifting animations

All animations should feel like luxury fashion UI.

Respect:

```text
prefers-reduced-motion
```

---

# 21. ADMIN CUSTOMIZATION PHILOSOPHY

The Admin Dashboard should eventually allow non-developers to control the business.

However, do NOT make every tiny CSS value editable.

Admin controls should focus on business-relevant settings:

- brand
- content
- products
- collections
- pricing
- builder options
- orders
- production
- shipping
- promotions
- SEO
- notifications
- analytics
- AI feature toggles

Developer-only configuration should remain in code/environment variables.

---

# 22. DATA FLOW

Main customer flow:

```text
Visitor
  ↓
Homepage
  ↓
Collection
  ↓
Product OR Custom Builder
  ↓
Configuration
  ↓
Inspiration
  ↓
Measurements
  ↓
Enquiry / Consultation
  ↓
Admin Review
  ↓
Quotation
  ↓
Customer Approval
  ↓
Deposit / Full Payment
  ↓
Order Created
  ↓
Production
  ↓
Quality Check
  ↓
Shipping
  ↓
Tracking
  ↓
Delivery
  ↓
Review
  ↓
Loyalty / Referral / Retention
```

---

# 23. PRODUCTION DATA FLOW

```text
Customer Order
      ↓
Admin Review
      ↓
Production Order
      ↓
Pakistan Tailoring Team
      ↓
Materials
      ↓
Embroidery
      ↓
Stitching
      ↓
Finishing
      ↓
Quality Control
      ↓
Approved
      ↓
Shipping
      ↓
UK Customer
```

Every status transition should be traceable.

---

# 24. QUOTATION FLOW

```text
Customer Configuration
        ↓
Estimated Configuration
        ↓
Enquiry
        ↓
Admin Review
        ↓
Admin Adjusts Price
        ↓
Quotation Created
        ↓
Customer Receives Quote
        ↓
Customer Accepts
        ↓
Deposit Payment
        ↓
Order Created
```

Quotation records should preserve the quoted price at the time of approval.

Never recalculate an existing approved quote unexpectedly.

---

# 25. PAYMENT FLOW

Example:

```text
Quotation Approved
      ↓
Deposit Required
      ↓
Deposit Paid
      ↓
Production Begins
      ↓
Production Completed
      ↓
Remaining Balance
      ↓
Balance Paid
      ↓
Ready For Shipping
```

Admin must be able to configure deposit rules.

---

# 26. IMPORTANT ARCHITECTURAL ABSTRACTIONS

Build provider-independent interfaces for:

### Payments

```text
PaymentProvider
 ├── StripeProvider
 └── PayPalProvider
```

### Notifications

```text
NotificationProvider
 ├── MockNotificationProvider
 ├── EmailProvider
 └── WhatsAppProvider
```

### Shipping

```text
ShippingProvider
 └── MockShippingProvider
```

### AI

```text
AIProvider
 ├── MockAIProvider
 └── ProductionAIProvider
```

### Analytics

```text
AnalyticsProvider
 ├── LocalAnalyticsProvider
 └── ExternalAnalyticsProvider
```

This keeps the project free-first while allowing production upgrades.

---

# 27. SEO URL STRUCTURE

Suggested:

```text
/
 /collections
 /collections/[slug]
 /products
 /products/[slug]
 /custom-lehenga
 /custom-lehenga/builder
 /measurements
 /consultation
 /about
 /contact
 /journal
 /journal/[slug]

/account
/account/orders
/account/orders/[id]
/account/measurements
/account/wishlist
/account/profile

/checkout
/quote/[id]
/order/[id]

/admin
/admin/orders
/admin/products
/admin/customers
/admin/production
/admin/settings
...
```

Actual routes should be finalized during implementation.

---

# 28. FINAL QUALITY BAR

The completed website should feel like:

- a professional luxury fashion brand
- a real custom-commerce platform
- a secure application
- a scalable SaaS-quality codebase
- a production-ready admin system

It must NOT feel like:

- a student demo
- a basic CRUD application
- a generic template
- a static landing page
- a collection of disconnected screens

---

# 29. FINAL PROJECT ACCEPTANCE CRITERIA

The project is considered complete only when a customer can successfully:

1. Visit the website.
2. Browse collections.
3. View products.
4. Create an account.
5. Save a wishlist.
6. Build a custom lehenga.
7. Upload inspiration.
8. Enter measurements.
9. Submit enquiry.
10. Receive quotation.
11. Approve quotation.
12. Pay deposit using test payment.
13. Receive order.
14. Follow production status.
15. See shipping information.
16. Receive final balance request.
17. Complete balance payment.
18. Track delivery.
19. Receive the order.
20. Submit review.

Admin must be able to:

1. Manage brand settings.
2. Manage theme.
3. Manage products.
4. Manage collections.
5. Manage builder options.
6. Manage pricing.
7. Manage customers.
8. Manage measurements.
9. Manage enquiries.
10. Manage quotations.
11. Manage orders.
12. Manage production.
13. Manage payments.
14. Manage shipping.
15. Manage inventory.
16. Manage reviews.
17. Manage coupons.
18. Manage referrals.
19. Manage loyalty.
20. Manage SEO.
21. Manage content.
22. Manage notifications.
23. Manage analytics.
24. Manage permissions.
25. Manage system settings.

---

# 30. CLAUDE CODE MASTER INSTRUCTION

Paste the following instruction at the beginning of the project / keep it available to Claude Code:

```text
You are the lead software architect and senior full-stack engineer responsible for building this Luxury Lehenga E-Commerce Platform.

The file "Luxury-Lehenga-Master-Build-Plan.md" is the master roadmap and source of truth.

Technology decisions are locked unless explicitly changed by the project owner:

- Next.js 14
- React
- TypeScript
- Tailwind CSS
- Supabase
- Vercel
- Free/open-source tools during development

Build the application module by module.

DO NOT build the complete application in one response or one operation.

When the project owner says:

"Start Module X"

you must:

1. Read the Master Build Plan.
2. Inspect the existing repository.
3. Inspect previously completed modules.
4. Determine what already exists.
5. Create a detailed implementation plan for Module X.
6. Explain files/database changes before implementation.
7. Implement Module X only.
8. Reuse existing architecture.
9. Do not unnecessarily rewrite completed modules.
10. Run lint/typecheck/build/tests where applicable.
11. Fix implementation errors.
12. Verify the actual user flow.
13. Update documentation.
14. Update the module status in the Master Build Plan.
15. Report exactly what was implemented.
16. Report known limitations honestly.
17. Recommend the next module.

Do not mark a module COMPLETE unless its acceptance criteria are actually satisfied.

Follow secure software engineering practices.

Use Supabase RLS and server-side authorization.

Never expose secrets.

Never trust client-submitted prices, roles, payment states or order statuses.

Prefer free/open-source solutions during development.

When a production service would normally be paid, create a provider abstraction and implement a free/mock/development alternative.

The final application must be premium, responsive, accessible, performant, SEO-friendly, secure and maintainable.

The visual design should feel like a luxury couture/fashion brand with elegant modern animations.

Do not make the UI unnecessarily complicated.

Do not create fake functionality that looks real but is not wired to the actual application.

If a feature cannot yet use a real provider because the project is in development, clearly label it as a development implementation and create the correct production-ready abstraction.

Never silently change architecture.

If you believe a major architectural change is required, stop and explain the reason before implementing it.

At the end of every module, update the Master Build Plan status.

The project owner will open a new Claude Code chat for each module, so every module must leave the repository in a clean, understandable state for the next chat.
```

---

# 31. FIRST CLAUDE CODE PROMPT

For the first implementation chat, use:

```text
Read and fully understand Luxury-Lehenga-Master-Build-Plan.md.

Do NOT build the entire website yet.

We are starting MODULE 0 only.

First inspect the existing repository and determine whether this is a new project or an existing implementation.

Then create a detailed Module 0 implementation plan covering:

- Next.js 14 architecture
- Supabase integration
- folder structure
- environment configuration
- Tailwind
- TypeScript
- ESLint
- Prettier
- shadcn/ui
- Motion/animation system
- theme/design-token system
- reusable UI foundation
- route groups
- error/loading/empty states
- security foundation
- documentation
- development scripts

After the plan is approved internally, implement Module 0.

Do not start Module 1 or any business functionality.

At the end:

- run lint
- run typecheck if configured
- run production build
- fix all errors
- update Luxury-Lehenga-Master-Build-Plan.md
- mark Module 0 COMPLETE only if its acceptance criteria are satisfied
- provide a concise completion report
- tell me the exact next command I should use to start Module 1.
```

---

# 32. HOW TO CONTINUE IN NEW CHATS

After Module 0:

```text
Read Luxury-Lehenga-Master-Build-Plan.md.

Start Module 1 only.

Follow the module execution protocol defined in the Master Build Plan.
Inspect the current repository first.
Do not rebuild completed work.
Implement, test, document and mark Module 1 complete.
```

For Module 2:

```text
Read Luxury-Lehenga-Master-Build-Plan.md.

Start Module 2 only.

Follow the Master Build Plan exactly.
Inspect all existing work before changing anything.
Implement Module 2 completely, test it, document it and mark it complete.
```

Continue the same pattern for every module.

---

# 33. IMPORTANT NOTE ABOUT FUTURE COMMERCIAL LAUNCH

The development environment should remain free-first.

Before commercial launch, review and upgrade where required:

- hosting
- Supabase plan
- email provider
- WhatsApp Business API
- payment processing
- shipping APIs
- AI APIs
- analytics
- monitoring
- domain
- CDN/storage
- backup strategy

Do not pay for these services during development unless absolutely necessary.

The architecture must make future upgrades straightforward.

---

# 34. PROJECT STATUS

Master Plan Status:

`MODULES 0-31 COMPLETE` + `MODULE 36 COMPLETE`

Current Module:

`MODULE 36 — MCP FOUNDATION, TRANSPORT & TOOL REGISTRY — COMPLETE`

Outstanding, in two independent tracks:

- Deployment track: `MODULE 32 — PRODUCTION DEPLOYMENT` (not started),
  then `MODULE 33 — PRODUCTION READINESS & HANDOVER`.
- MCP track (Phase 6, see section 12B/12C): `MODULE 37 — MCP READ TOOLS`
  (not started), then 38-43.

Modules 34, 35 remain FUTURE PHASE and are out of the current commercial
plan.

Next Action:

`Start Module 37` (MCP track) or `Start Module 32` (deployment track)
