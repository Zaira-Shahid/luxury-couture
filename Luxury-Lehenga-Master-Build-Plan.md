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

**Scope extension, recorded after Module 36 on the developer's
instruction: MCP serves two audiences, not one.** Alongside the admin/staff
tools above, a second category lets a signed-in CUSTOMER ask about their
OWN data through the existing storefront chatbot (Module 23).

> "Where is my order?"
> "What measurements do you have on file for me?"
> "How many loyalty points do I have?"

The two audiences share one transport, one registry, one validation path
and one error model. They differ in exactly one respect — an admin tool
acts on ANY record its permission allows, a customer tool acts only on the
caller's OWN records. That difference is spelled out in 12B.16, which is
binding on every customer tool.

## 12B.2 Architecture

```text
Admin (signed-in, real Supabase session)      Customer (signed-in)
        |                                             |
Admin AI Chat (Module 42) / external client   Storefront chatbot (Module 23)
        |                                             |
Claude / AI assistant                         Claude / AI assistant
        |                                             |
        +----------------------+----------------------+
                               |
POST /api/mcp          <- JSON-RPC 2.0, MCP wire protocol
        |
MCP server (src/lib/mcp/server.ts)
        |
Tool registry  ->  tool definition
                   (schema, kind, audience, permission, risk)
        |
Zod validation  ->  authorization  ->  confirmation gate
        |               |
        |               +-- audience "admin"    -> role + permission check
        |               +-- audience "customer" -> signed-in + self-scope
        |
Application service (src/lib/<domain>/, src/features/<domain>/actions.ts)
        |
Supabase (RLS enforced AS THE CALLER)
        |
PostgreSQL / Storage
```

Both lanes are the same code path. The customer lane adds no second
transport, no second registry and no second server — only a declared
audience on the tool definition and the self-scoping rule of 12B.16.

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

Every tool declares an `audience` — `"admin"` or `"customer"` — and the
audience selects which checks apply. As of Module 36 every registered tool
is `audience: "admin"`; the customer audience is specified here and in
12B.16 and arrives with Module 44.

**Admin tools.** Each declares a `permission` from the existing 23-key
catalogue in `src/lib/auth/permissions.ts`. No new role and no new
permission key was invented for MCP — MCP is a second doorway to
capabilities the platform already models, so a new key would mean a
capability the admin UI cannot express.

Three checks run in order on every `tools/call` for an admin tool:

1. **Authenticated?** No session -> `UNAUTHORIZED`.
2. **Admin role?** A `customer` reaches no ADMIN tool at all -> `FORBIDDEN`.
3. **Holds the tool's permission?** Read from the DATABASE
   (`role_permissions`), not the code mirror -> `FORBIDDEN`.

**Customer tools.** The 23 permission keys are all staff capabilities —
`orders.read` means "read ANY order" — so none of them can express "read
my own order", and reusing one would grant a customer a staff capability.
Customer tools therefore declare no permission key. They are gated instead
by:

1. **Authenticated?** No session -> `UNAUTHORIZED`. Anonymous visitors
   reach no customer tool; the chatbot's existing FAQ and discovery
   answers stay available to them, unchanged.
2. **Self-scope.** The handler resolves the caller's id server-side and
   filters on it. Never a client-supplied id — see 12B.16.

This is a deliberate, recorded amendment to the original rule "a customer
reaches no MCP tool at all". It is narrowed rather than dropped: a
customer still reaches no tool that can name another person's record, and
inventing a customer permission key was rejected because it would imply a
capability the admin UI does not model.

`tools/list` is filtered by audience first and then by permission, so a
customer session is never told that `payments_refund` exists, and an
assistant acting for a Production account is not told either. That
filtering is a **usability** measure, not the enforcement: the checks above
run on the call regardless of what was listed, because a client can call a
name it was never shown.

Fails closed everywhere. A failed permission lookup reads as "refused", and
an unresolvable caller identity reads as "refused" rather than "no filter".

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

**Observability, added in Module 43.** Reads are still not written to
`audit_logs`. What changed is that every call — read or write — now
increments an hourly counter per tool in `mcp_tool_stats`, and every
FAILURE gets a row in `mcp_tool_failures` with its redacted arguments.
The original rule was right about successes (a row per read would be a
second copy of the catalogue) and wrong about refusals, which are the one
event an operator goes looking for and which were persisted nowhere at
all until this module. Both tables are service-role write only and
`settings.manage` read; `/admin/assistant/activity` is the screen.

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

**Customer tools: `<domain>_my_<action>` (DECIDED).** Approved by the
developer on 28 August 2026, at the same time as the Module 44 number.
`orders_my_list`,
`orders_my_get`, `measurements_my_list`, `addresses_my_list`,
`quotations_my_list`, `appointments_my_list`, `loyalty_my_balance`,
`notifications_my_list`.

Rejected alternative, recorded so it is not re-proposed: the scope
instruction that authorised these sketched them as `get_my_orders`,
`get_my_addresses` and so on. Verb-first breaks the domain-first sort this
section already fixed as DECIDED — `get_my_orders` and `orders_list` would
sit in different places in `tools/list` while describing the same domain.
The `_my_` infix carries the same meaning and keeps one convention: an
assistant reading the tool list sees every orders tool together, with the
self-scoped one visibly marked.

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
    catalog-write.ts  Module 38's writers, split from catalog.ts (below)
    customer/     customer-audience tools (Module 44), one file per domain
src/app/api/mcp/route.ts
```

One file per domain. No single file containing every tool.

**Read and write may split within a domain (Module 38).** The catalogue
writers live in `catalog-write.ts` rather than being appended to
`catalog.ts`. The rule's purpose is that reviewing a module means
reviewing one file; eleven writers appended to a 300-line reader file
would have kept the letter of it and lost the point, and read-vs-write is
the axis a security review actually cuts along. The rule is unchanged for
everything else: no file holds two domains.

Customer tools live under `tools/customer/` rather than mixed into the
admin domain files. The split is not cosmetic: it makes "which tools can a
customer reach" answerable by looking at a directory, and it makes an
admin tool accidentally registered with `audience: "customer"` visible in
review rather than buried in a 300-line file.

## 12B.11 Business-logic rule

MCP must NOT create a second business-logic system. Tools call the same
readers in `src/lib/<domain>/` and the same writers in
`src/features/<domain>/actions.ts` that the admin UI calls. Where a Server
Action's signature is `FormData`-shaped, the tool builds the FormData rather
than reimplementing the mutation — the validation, the business rules and
the revalidation must not be able to drift apart.

If a tool ever genuinely needs privileged access, it must be documented
here with the reason and confined to that one operation.

**The one privileged read, as of Module 37: `customers_get`.**

`getAdminCustomerDetail()` fetches the customer's email address through
the service-role client, because email lives in `auth.users` and no
RLS-respecting query can reach it. Approved by the developer before
Module 37 was built, and bounded four ways:

- **One field.** The email address, and nothing else. Every other field
  in that record — profile, orders, quotations, addresses, loyalty,
  referrals — is read under the caller's own client and refused by RLS if
  they may not see it.
- **After the caller was already granted the record.** The profile row is
  fetched under the caller's RLS FIRST, and a caller who may not see this
  customer gets nothing back before the elevation is reached.
- **Behind the same permission as the page.** `customers.read`, which
  `/admin/customers` already requires. The tool exposes exactly what the
  admin customer page exposes to the same person.
- **Nowhere else.** No other tool in Module 37 touches the service-role
  client, and `customers_search` returns no contact details at all —
  searching for a customer and reading their file are different acts.

Rejected alternative: omitting email from the tool. It would keep "no MCP
tool holds privileged access" absolutely true, at the cost of a tool that
returns less than the page it mirrors, and an assistant unable to answer
"what is this customer's email?" — weaker without being safer.

### Reader options (Module 37)

Readers in `src/lib/<domain>/` now take an optional `ReaderOptions`
(`src/lib/supabase/reader.ts`). It exists because a reader serves two
callers with opposite requirements, and Module 37 was where they collided:

- `client` — the Supabase client to query with. MCP passes the CALLER'S
  client. This is not a nicety: readers build their own from request
  COOKIES when none is given, and an MCP call over the Bearer transport
  carries no auth cookie, so a reader left to itself would query
  anonymously, RLS would filter every row, and the tool would answer "no
  orders" to a super-admin. A silent wrong answer is worse than a refusal.
- `throwOnError` — turn a swallowed query failure back into an error.
  Readers log and return `[]` so a page degrades gracefully; a tool must
  not, or an assistant relays "you have no pending orders" as fact when
  the query broke. See 12B.8.

Pages pass neither and behave exactly as they did.

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

## 12B.14 Known limitations (as of Module 42)

- Fifty tools exist: the three system tools (Module 36), the fourteen
  read tools (Module 37), the eleven catalogue write tools (Module 38),
  the seven order, production and enquiry write tools (Module 39), the
  ten content and SEO tools (Module 40) and the five analytics tools
  (Module 41). Every tool the MCP roadmap specified through Module 41 now
  exists.
- The reporting figures are computed in the application, not in the
  database. `salesSummary` and `orderSummary` fetch the rows in a window
  and sum them in JavaScript rather than using an aggregate RPC, which is
  correct for this catalogue's volume and would not be at ten thousand
  orders a month. The event summaries already go through RPCs; the
  commercial ones should follow if the numbers grow.
- 12B.12's `draft -> review -> approve -> publish` is NOT implemented as
  four states. `blog_posts` and `pages` have two, draft and published.
  Module 40 added the AI-generated MARKING (0064) and enforces "never
  auto-published" by giving the drafting tool no status argument, so the
  binding half of the rule holds. The intermediate review and approve
  states, and a screen to move records through them, are not built.
- `/admin/seo` and `/admin/marketing` are gated on `content.write`, but
  migration 0054 gates `site_settings` on `settings.manage` and
  `promotional_banners` on `marketing.write`. A marketing account can
  therefore open /admin/seo and have every save refused by RLS. Found in
  Module 40, not caused by it; the MCP tools take the permission the
  database requires, so they are unaffected.
- No customer-facing tools exist. The customer audience is SPECIFIED in
  12B.16 and scheduled as Module 44; nothing in it is built, and every
  registered tool today is admin-audience.
- Read tools page in memory. `paginate()` slices a full reader result
  rather than pushing `limit`/`offset` into the query, because the readers
  are shared with pages that need the whole set and several compute
  aggregates across every row first. Correct and bounded at this scale; a
  catalogue in the tens of thousands would want the cap pushed into SQL.
- `customers_search` matches on name only. There is no email search,
  because `customers_search` deliberately returns no contact details.
- No streaming, no MCP resources, no prompts, no sampling — `tools/*` only.
- THE ADMIN CHAT IS UNTESTED AGAINST A LIVE MODEL. Module 42's 84 checks
  drive the real loop, the real dispatcher, the real confirmation gate and
  the real replay ledger — with a SCRIPTED model. That proves what the
  loop does with a given model output; it proves nothing about what the
  model does with a given question. No suite spends an API call, and this
  deployment has no `ANTHROPIC_API_KEY` set, so the screen has never been
  exercised end to end. First run with a key is the real acceptance test.
- The chat holds its conversation in the browser and nothing else. Closing
  the tab ends it; there is no history, no resume and no transcript to
  audit — only the per-call audit rows every tool already writes. A
  transcript table was rejected (MCP-024), not forgotten.
- The chat is not streamed. A turn that makes several tool calls shows
  "Working…" until the whole turn finishes, which on a slow multi-tool
  question is several seconds of nothing. Streaming would need the route
  to hold a stream open through the loop, and was not built.
- A turn is capped at 12 iterations and reported as a failure past that.
  A question genuinely needing more tool calls than that cannot be
  answered by asking harder; it needs a tool that answers it in one.
- CLOSED IN MODULE 38. Confirmation tokens are still stateless HMACs, but
  the dispatcher now SPENDS one before acting, against the ledger in
  `0063_mcp_confirmations.sql`. The signature is the primary key, so two
  concurrent calls carrying the same token cannot both write — Postgres
  decides the race, not application timing — and a ledger that cannot be
  reached fails the action closed rather than guessing. The table has RLS
  on with no write policy at all: a ledger an administrator could delete
  from is a ledger an administrator could defeat.
- Writes are audited but not *diffed*. The audit row records the request,
  the outcome and the record touched; it does not store the previous
  values of every field. `products_publish` and `builder_options_*` return
  the previous status because their services read it anyway, but a general
  before/after diff is not implemented.
- Status transition rules are enforced for MCP and NOT for the admin UI,
  which passes `allowCorrection: true` and can still set any status from
  any status (Module 39). That is deliberate — see Module 39 — but it
  means "the application permits only forward moves" is true of the tools
  and not of the product. A UI that offered only the legal next steps
  would be the honest end state, and is not built.
- Writes are still not diffed (Module 38), and the order and production
  services now return the previous status because they read it anyway.
  A general before/after diff is still not implemented.
- The endpoint is session-bound, so an external MCP client must supply a
  real user access token (12B.3). CLOSED IN MODULE 43 as far as transport
  goes: `scripts/mcp-stdio.mjs` is a stdio adapter, but it is a PROXY to
  the HTTP endpoint rather than a second in-process transport, and the
  token it carries expires within the hour and is not refreshed.
- Rate limiting is per-actor and table-backed; it throttles a runaway loop,
  it is not a defence against a distributed attack. Unchanged in Module
  43, which recorded the refusals rather than strengthening the limit —
  and the limiter still FAILS OPEN if its own table is unreachable.
- Counting started with Module 43. An empty activity screen for a window
  before that date is not evidence that nothing happened in it.
- The oversized-body check reads `content-length`; a request that omits
  the header is bounded only by the platform's own limit.

## 12B.15 Not permitted, permanently

No `execute_sql`. No shell execution. No filesystem access. No arbitrary
HTTP. No unrestricted Supabase access. No exposure of the service-role key
to the browser or to any model. No tool that takes a table name as an
argument.

## 12B.16 Customer-facing tools (SPECIFIED, not yet built)

Added after Module 36 on the developer's instruction. Nothing in this
section is implemented; it is the contract Module 44 must meet.

### The five rules

1. **Ownership is re-checked in the application layer, not left to RLS.**
   Every customer tool filters on the caller's own id — resolved
   server-side from the Supabase session — in addition to whatever RLS
   already enforces. This is the same defence-in-depth the codebase
   already uses: `acceptQuotation` re-checks
   `quotation.customer_id !== user.id` before acting, even though RLS
   would already have refused. Two independent barriers, so a policy
   regression alone cannot leak a record.
2. **Read-only in this phase.** No customer write tool — no address edit,
   no order cancellation, no appointment rescheduling. A customer types
   free-form natural language with no staff training and no review step,
   so the cost of a misread instruction is borne by someone who never
   approved it. Customer writes are a separate decision requiring their
   own review, not an increment of this module.
3. **Identity is resolved server-side, never claimed by the client.** The
   caller's id comes from the Supabase session on the request. A
   `customerId` argument in a tool's input schema is a defect, not a
   convenience: it would let an assistant — or anyone crafting a request
   — name a person and be believed. The tool schemas must not accept one,
   and the registry test must assert that none does.
4. **Cross-customer isolation is explicitly security-tested.** The bar is
   the one already applied to RLS work in `scripts/verify-cross-user.mjs`:
   create two real customers, sign both in, and assert that each one's
   tools return their own rows and NOTHING of the other's — by id, by
   count, and by attempting to fetch the other's record directly by its
   id and getting `NOT_FOUND` rather than a row. A customer tool is not
   complete until the negative half of that test exists.
5. **The storefront chatbot is the entry point, not a new surface.** These
   tools extend the Module 23 chatbot's existing FAQ and discovery
   capability. No new page, no new widget, no second chat.

### What the chatbot needs before it can carry them

`/api/chat/route.ts` as built for Module 23 is ANONYMOUS. It never calls
`auth.getUser()`, and it rate-limits on a client-supplied `sessionId` plus
the request IP. A client-supplied session id is not an identity and must
never be treated as one.

Module 44 therefore has to add authenticated identity to that route —
resolving the real user from the Supabase session — while leaving the
anonymous FAQ and discovery paths working exactly as they do now. A
visitor who is not signed in must get the current behaviour, not an error
and not a login wall.

### Reuse, not reimplementation

12B.11 applies unchanged: these tools call the readers the account pages
already call. Most exist and are already self-scoped:

- `getMyOrders`, `getOrderDetail` — `src/lib/orders/get-orders.ts`
- `getMeasurementProfiles`, `getMeasurementProfile` —
  `src/lib/measurements/get-profiles.ts`
- `getMyAppointments` — `src/lib/consultations/get-appointments.ts`
- `getMyLoyaltyAccount` — `src/lib/loyalty/get-loyalty.ts`
- `getNotificationFeed` — `src/lib/notifications/get-notifications.ts`

Two have no reader to call. Addresses and the customer's own quotations
are queried inline inside their page components —
`src/app/(account)/account/addresses/page.tsx` and
`src/app/(account)/account/quotations/[id]/page.tsx`. Module 44 must
extract those into `src/lib/<domain>/` readers and have BOTH the page and
the tool use them. Copying the query into a tool handler would create the
second business-logic system 12B.11 forbids.

### Data minimisation

A chatbot answer is rendered into a page and may be logged. Customer tools
return the fields needed to answer the question and no more — no payment
tokens, no internal staff notes, no admin-only order fields, no other
person's name or contact details on a shared record. Where a reader
returns an admin-shaped row, the tool narrows it before returning.

### Audit

These tools are `kind: "read"`, so 12B.5 applies: no `audit_logs` row.
The application log records the call as it does for every read tool. When
customer WRITE tools are eventually authorised, they are audited like any
other write.

---

# 12C. PHASE 6 — MCP MODULE ROADMAP

Appended as Modules 36-44. Modules 0-35 are unchanged and unrenumbered;
document order is not build order, so Phase 6 may run before Modules 32-33.

Module 44 was appended after 43 rather than inserted next to Module 37,
which is where it belongs by dependency. Inserting it would have
renumbered 38-43 after they were already written down, and a module number
that moves is worse than one that sits out of build order. Build order is
stated per module; 44 is buildable as soon as 37 is done.

DECIDED, 28 August 2026: the developer approved the number 44 and the
dependency order — Module 37 is built first, then 44 reuses its read-tool
patterns. 44 is not to be started before 37 is complete.

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

Status: [x] COMPLETE

Fourteen read-only tools over catalogue, orders, enquiries, production,
customers and builder options. Each gated by its existing permission key.
No writes.

Shipped: `products_list`, `products_get`, `collections_list`,
`collections_get`, `builder_options_list`, `builder_options_get`,
`orders_list`, `orders_get`, `enquiries_list`, `enquiries_get`,
`customers_search`, `customers_get`, `production_list`, `production_get`.

**The permission rule: a tool takes the permission its admin page takes.**
`catalog.read` for products, collections and builder options;
`orders.read`; `enquiries.read`; `customers.read`; `production.read`. No
new key was invented, because MCP is a second doorway to a capability the
platform already models.

Three defects were found by inspection before any tool was written, and
closing them was most of the module:

1. **Every reader ignored the caller's client.** They call `createClient()`
   internally, which reads COOKIES, while MCP's actor may arrive over the
   Bearer transport with no cookie. Left alone, `orders_list` would have
   answered "no orders" to a super-admin — a silent wrong answer, and the
   worst failure mode available. Fixed by `ReaderOptions.client` (12B.11),
   and guarded by a transport-parity test that calls every tool over BOTH
   transports and compares totals.
2. **Readers swallowed errors and returned `[]`.** Correct for a page,
   forbidden for a tool by 12B.8. Fixed by `ReaderOptions.throwOnError`;
   the thrown `PostgrestError` is mapped by the existing `toMcpError()`,
   so 42501 reads as FORBIDDEN and nothing else leaks.
3. **Admin products and collections had no reader at all** — both were
   queried inline in their page components. Extracted to
   `src/lib/catalog/get-admin-catalog.ts` and used by BOTH the pages and
   the tools, rather than copying the queries into handlers (12B.11).

Also in this module: `_list` tools cap results (default 20, max 100,
`{ items, total, offset, limit, hasMore }`), because the readers return
everything and an unbounded result goes into a model's context window.
`builder_options_*` takes a closed enum of business names — `fabric`,
`embroidery`, `colour`, `sleeve`, `neckline`, `dupatta` — mapped to tables
inside the tool, so no table name is ever an argument (12B.15).

Tests: `scripts/test-mcp-read.mjs`, 245 checks. The weight is on transport
parity, on every tool being refused for every role lacking its key, on a
customer reaching none of the fourteen, and on a missing record returning
NOT_FOUND rather than an empty success.

# MODULE 38 — MCP WRITE TOOLS & CONFIRMATION WORKFLOW

Status: [x] COMPLETE

The first mutating tools, and the confirmation replay ledger noted in
12B.14. Eleven tools, all `catalog.write`:

- `products_create`, `products_update` (medium)
- `products_publish`, `products_archive` (high)
- `collections_create`, `collections_update` (medium)
- `collections_set_visibility` (high)
- `builder_options_create`, `builder_options_update`,
  `builder_options_activate` (medium)
- `builder_options_deactivate` (high)

Four decisions were taken while building it, each because the obvious
version was wrong rather than merely untidy.

**Status is not a field on the editors.** `products_create` always
creates a draft and `products_update` carries the stored status forward;
neither schema accepts `status` at all. 12B.6 makes publishing and
archiving high-risk while a description edit is not, and `risk` is
declared per TOOL — one editor that also set status would be an
unconfirmed publish tool wearing a different name. The same reasoning
splits `collections_set_visibility` and
`builder_options_activate`/`_deactivate` out of their editors.
Deactivation is high and activation is medium: withdrawing an option
takes away something a customer may be halfway through choosing, while
offering one is additive and reversible.

**Omission is not deletion.** The updaters read the record and merge what
they were given onto what is there, and the collection-shaped fields
(`images`, `productIds`) treat an omitted value as "leave unchanged". An
assistant asked to fix a typo sends one field; had omission meant `null`,
that call would have blanked the price, the SKU and every photograph —
destruction by a medium-risk tool with no confirmation. The merge happens
BEFORE the domain schema runs, so the schema still validates the whole
record and 12B.11 still holds.

**The writers were extracted, not reimplemented (12B.11).** The four
Server Action creates and updates moved into `src/lib/catalog/
write-catalog.ts` and `src/lib/builder/write-options.ts`, and the actions
now call them. Three concrete defects forced it: the creates ended in
`redirect()`, which THROWS and would have been mapped to INTERNAL_ERROR
after the row was already inserted (reporting a successful write as a
failure, the inverse of 12B.8); the actions built their own client from
request COOKIES, which a Bearer call does not carry, so every write would
have run anonymously and been refused by RLS; and `ActionResult` carries
no id, which an audit row needs.

**Tool schemas are not the domain schemas.** `productSchema` and friends
are FormData-shaped — coercions, `"" | undefined` unions, transforms to
`null` — and `z.toJSONSchema()` refuses transforms outright, so
advertising them through `tools/list` would have thrown. The tools
declare the plain JSON shape a model can be shown, and every value still
passes through the domain schema before it reaches a service.

Also added: `revalidatePath` on the tool side (Next's cache does not know
a write happened outside a Server Action, so a product published through
MCP would sit invisible on the storefront), and migration
`0063_mcp_confirmations.sql`.

Verified by `scripts/test-mcp-write.mjs` — 239 checks, including two
concurrent confirmed calls racing for the same token, where exactly one
must win.

# MODULE 39 — MCP ORDER & PRODUCTION TOOLS

Status: [x] COMPLETE

Seven tools: `orders_update_status`, `orders_cancel` (both high),
`orders_add_note`, `production_advance_status`, `production_record_qc`,
`production_update_details` and `enquiries_update_status` (all medium).

**The workflow validation this module was told to go through did not
exist.** The instruction above was to route status changes through the
application's existing rules rather than write the column directly.
There were no rules. `orders.status` was checked three times and every
check asked the same question — is this one of the seven allowed
strings: `updateOrderStatusSchema`, the table's CHECK constraint, and the
admin dropdown, which listed all seven unconditionally. Nothing anywhere
asked whether the move made sense from the CURRENT status, so a
delivered order could be walked back to pending, and
`advanceProductionStatus` — named "advance" — would write any of the
twelve stages, including one six steps behind.

So the rules were written, in `src/lib/orders/transitions.ts` and
`src/lib/production/transitions.ts`, as a domain service both doorways
read. Forward moves are allowed and may skip stages, because the
business genuinely skips them — a ready-to-wear piece never enters
production, a piece with no embroidery goes from materials to
stitching. Backward moves are not a workflow step; they are a
correction.

**The admin UI keeps the freedom it had.** The rules take an
`allowCorrection` flag. The three admin forms pass `true` and behave
exactly as before; every tool passes `false`. The asymmetry is the
point rather than an oversight: a correction is a human judgement about
a mistake, and an assistant cannot tell a mistake from an instruction.
Removing the capability from the people who have it, in the name of a
rule written for assistants, would have been this module doing damage on
its way past.

**`production_update_qc_status` became `production_record_qc`, because
there is no QC status to update.** No `qc_status` column exists;
`quality_check` is one of the twelve pipeline stages. But QC is not
missing — migration 0054 gives `qc.write` its own INSERT policy on
`production_status_history`, separate from `production.write`, with the
comment "a QC user must be able to record a result WITHOUT being able to
move the job through production themselves". The database drew the line
before any tool existed. So the tool records an outcome as a history row
at the job's CURRENT stage and moves nothing, and the two permissions
are tested in both directions.

**Order status changes are high risk, which is stronger than the
catalogue.** 12B.6 makes publishing high-risk; an order status change is
worse in one specific way — it emails the customer. A wrongly published
product can be unpublished; a customer told their order shipped cannot
be untold. Production stages are medium: they are an internal record of
where work has reached, not a claim about the outside world.

Also fixed on the way through: `advanceProductionStatus` wrote history
but never wrote an `audit_logs` row, so the audit trail covered the
order pipeline and not the twelve stages the garment actually passes
through. It audits now.

Payment status and refunds stay out of MCP, as instructed. Nothing in
this module touches money.

Verified by `scripts/test-mcp-orders.mjs` — 178 checks.

# MODULE 40 — MCP CONTENT & SEO TOOLS

Status: [x] COMPLETE

Ten tools: `content_get_homepage`, `content_list_banners`,
`content_create_banner`, `content_update_banner`,
`content_set_banner_active`, `content_draft_blog_post`,
`seo_get_settings`, `seo_update_settings`, `seo_set_indexing`,
`seo_update_override`.

Three of the five tools this module was specified with named things that
do not exist — the second module running, which is why the warning below
is now stated twice.

**`content_update_announcement` had no target.** It names Module 3's
single global `store.announcement_*` banner. Module 19 Pass 2 replaced
that mechanism with `promotional_banners` — several, scheduled, each
independently active — and `lib/settings/types.ts` records that the
leftover keys are "harmlessly ignored". A tool written to the
specification would have reported success and changed nothing a visitor
could see. The four banner tools are the honest equivalent.

**12B.12's `draft -> review -> approve -> publish` does not exist, and
neither did the AI marking.** `blog_posts` and `pages` carry two states,
draft and published. No column anywhere recorded that an AI wrote
something. Migration `0064_ai_generated_content.sql` adds the MARKING,
because without it AI copy is indistinguishable from a person's — exactly
what 12B.12 forbids. It deliberately does NOT add `review` and `approved`
states: those need a screen for a human to approve on, and two states no
interface can clear would strand every AI draft in a status nobody can
move. The rule is enforced by absence instead — `content_draft_blog_post`
takes no `status` and no `ai_generated` argument, so it can only write a
marked draft, and no MCP tool anywhere can publish content. The human
publish action in /admin/content is the approval step. The missing
intermediate states are recorded in 12B.14.

**`seo_update_product` became `seo_update_override`**, covering products,
collections, pages and blog posts, because `seo_metadata` is one table
keyed by `(entity_type, entity_id)` and the service already handled all
four. `entityType` is a domain enum stored in a column, not a table name,
so 12B.15 holds — asserted by trying `site_settings`, `profiles` and
`orders` as values.

**A PERMISSION MISMATCH THIS MODULE FOUND, and did not create.** Module
37's rule was "a tool takes the permission its admin page takes". For the
catalogue, orders and production the route gate and the RLS policy agree.
Here they do not. Migration 0054 gates `promotional_banners` on
`marketing.write` and `site_settings` on `settings.manage`, while
`/admin/marketing` and `/admin/seo` are both reachable with
`content.write`. So a marketing user can open /admin/seo today and every
save fails against RLS. That is a live bug in the admin UI, recorded in
12B.14 rather than fixed here, because changing a route gate is a
permissions decision rather than an MCP one.

The tools take what the DATABASE requires, not what the route requires:
banners are `marketing.write`, the two `site_settings` writers are
`settings.manage`, blog drafting and the SEO override are `content.write`.
Declaring the route's key would have listed tools for a role RLS then
refuses — worse than not listing them at all.

**`seo_set_indexing` is its own high-risk tool.** Editing a title costs a
worse search snippet; blocking indexing removes the whole site from
search, and rankings do not return the moment it is switched back on. The
same reasoning that split `products_publish` from `products_update`.

Also fixed on the way through: `setIndexingEnabled` first read an absent
setting as "indexed". This project's default is `indexingEnabled: false`,
so the confirmation prompt would have described a change that was not the
one about to happen. It reads `DEFAULT_SITE_SETTINGS` now. The suite
caught it.

Verified by `scripts/test-mcp-content.mjs` — 192 checks.

# MODULE 41 — MCP ANALYTICS & REPORTING TOOLS

Status: [x] COMPLETE

Five read tools: `analytics_sales_summary`, `analytics_order_summary`,
`orders_pending_summary`, `analytics_customer_summary` and
`analytics_events_summary`.

**The module is called "analytics" and only one of its tools may take
`analytics.read`.** Migration 0054 gates that key on `analytics_events`
and nothing else. `orders` needs `orders.read`, `payments` needs
`payments.read`, `profiles` needs `customers.read`. The `marketing` role
holds `analytics.read` and none of those three, so the four specified
tools, had they declared the key their names suggest, would have been
listed for a marketing account and refused by Postgres on every call —
the defect MCP-017 was written about. Each tool declares the key its
TABLE requires; only the events summary takes `analytics.read`.

That fifth tool was added rather than specified. Without it
`analytics.read` would grant nothing at all through MCP, and the site's
actual visitor analytics — the event counts and the conversion funnel
already on /admin/analytics — would be the one thing an analytics module
could not report.

**The aggregation layer did not exist.** `src/lib/analytics/` is entirely
event TRACKING — consent, event names, the client and server emitters —
and `src/lib/admin/get-analytics.ts` reports on `analytics_events` alone
through three RPCs. Nothing anywhere aggregated commercial figures:
`getDashboardStats()` computes a fixed set of counts for one screen, with
no date range and no breakdown. `src/lib/analytics/reporting.ts` is new.

**Aggregates only, enforced in the service rather than the tool.** The
plan's rule is that no tool returns a customer list as an analytics
result. `customerSummary` uses head-only counts, so no profile row is
fetched at all — there is nothing in memory to leak and no future edit
can widen a `select("id")` into a `select("*")`. The suite checks every
response against a real seeded customer's email and id rather than
against a regex for what an email looks like.

Three judgements worth recording. Revenue counts SUCCEEDED payments only,
because a pending payment is money somebody intends to send and counting
it would overstate every figure — `getDashboardStats()` already made that
choice and the two must not disagree about what revenue means. A status
breakdown lists every status INCLUDING the zeroes, because "no cancelled
orders" and "the key was absent" are not the same claim. And a period
compared against an empty previous period reports `null`, not a
percentage: "+100%" for the first sale ever is a number an assistant
would repeat as though it meant something.

`orders_pending_summary` takes no date range, because "what still needs
doing" is a question about the present; it reports the oldest open
order's date, since a count hides the order that has been stuck since
April.

Verified by `scripts/test-mcp-analytics.mjs` — 95 checks.

# MODULE 42 — ADMIN AI CHAT INTERFACE

Status: [x] COMPLETE

The in-dashboard chat that drives the MCP tools, including the human
confirmation step for high-risk actions and a plain-language rendering of
tool results.

Built:

- `src/lib/mcp/chat.ts` — the loop. `runAssistantTurn()` takes the
  conversation and a message and returns it answered, failed, or stopped
  awaiting a person. `resumeWithApproval()` is the separate entry point a
  click reaches.
- `POST /api/admin/assistant` — HTTP only: parse, authenticate through
  `resolveCaller()`, rate limit per actor at 20 turns, dispatch.
- `/admin/assistant` and `components/admin/assistant-chat.tsx` — the
  screen, the transcript, the tool-call disclosure and the approval card.
- `scripts/test-admin-assistant.mjs` — 84 checks, with
  `scripts/lib/assistant-loop-checks.mjs` driving the real loop from a
  scripted model and `scripts/lib/ts-node-hook.mjs` letting Node import
  the `.ts` modules to do it.

The four decisions are MCP-022 to MCP-025 in `docs/MCP-DECISIONS.md`. The
first is the module: THE MODEL NEVER HOLDS A CONFIRMATION TOKEN. Handing
it both halves of the two-step would have kept the ceremony 12B.6 asks
for and lost its purpose, so the loop stops at `CONFIRMATION_REQUIRED`
and the server supplies the token only after a human approves.

One defect was found and fixed while testing that: the first draft
dispatched whatever tool an approval named, which for a tool that is NOT
high risk would have executed it and then reported "nothing was changed".
An approval is now refused unless the registry itself calls the tool high
risk, before anything is dispatched.

Nothing was needed from the model's own judgement about safety, and
nothing depends on it: filtering the tool list to the actor is a
usability measure, and the dispatcher refuses a hidden tool anyway.

# MODULE 43 — MCP PRODUCTION HARDENING & OBSERVABILITY

Status: [x] COMPLETE (30 August 2026)

Tool-call metrics, authorization-failure visibility in Admin, an MCP section
in the security audit, load and abuse testing, and a stdio adapter for
external MCP clients.

A FIFTH WRONG PREMISE, and this one was load-bearing. This section
described the work as adding VISIBILITY to data that existed. It did not
exist. `recordToolCall()` returned early for every non-write tool, so an
authorization refusal on any of the nineteen read tools was persisted
nowhere at all — and no admin screen has ever read `audit_logs`, which
has been written to since Module 29. The module therefore had to CREATE
the record before it could show it.

What was built:

- `0065_mcp_observability.sql` — `mcp_tool_stats` (one row per tool per
  hour, incremented by an `on conflict` RPC so concurrent calls cannot
  lose an increment) and `mcp_tool_failures` (one row per refusal, with
  redacted arguments). Neither table takes an insert, update or delete
  policy; both are read-gated on `settings.manage`. See MCP-026, MCP-027.
- `src/lib/mcp/metrics.ts`, called from `recordToolCall()` BEFORE the
  write-only early return, and never able to throw.
- `/admin/assistant/activity`, gated on `settings.manage` rather than on
  "any admin", because it shows every staff account's refusals side by
  side.
- A body-size refusal on `/api/mcp` before the body is parsed, and a
  recorded event for every rate-limited request — a 429 previously left
  no trace at all.
- `scripts/mcp-stdio.mjs`, a PROXY to `/api/mcp` rather than a second
  in-process transport (MCP-028), with a `--token` helper.
- `scripts/test-mcp-abuse.mjs` — 59 checks that ask the endpoint
  improperly and then assert that the refusal was written down.
- `docs/SECURITY.md` gained the MCP section it never had; the audit
  predates the whole track by seven modules.

The 12B.7 rule "reads are not audited" is kept, not reversed: successes
are counted, refusals are kept. A thousand calls in an hour remain one
row, so nothing here grows with traffic.

What this module did NOT close, stated rather than implied: the rate
limiter still fails open on its own failure and is still not a defence
against a distributed attack; the body cap reads `content-length`, so a
request omitting the header is bounded only by the platform limit; the
stdio adapter's access token expires within the hour and is not
refreshed; and the assistant has still never run against a live model on
this deployment.

# MODULE 44 — MCP CUSTOMER SELF-SERVICE READ TOOLS

Status: [ ] NOT STARTED

Build order (DECIDED, 28 August 2026): after Module 37, not after Module
43. It is numbered last only because renumbering an existing module is not
allowed (see above). It depends on Module 36 (registry, transport,
authorization, error model), Module 37 (the read-tool patterns — result
envelope, pagination, the read-tool test shape) and Module 23 (the
storefront chatbot). It does NOT depend on Modules 38-43.

Module 37 is COMPLETE as of this revision, so 44 is unblocked. Its
read-tool patterns — `ReaderOptions` for the caller's client, `paginate()`
for result caps, and the transport-parity test shape — are what 44 reuses
rather than inventing a parallel set.

The first `audience: "customer"` tools. Read-only. Governed by 12B.16,
which is binding and not restated here.

Expected tools, named per 12B.9:

- `orders_my_list`, `orders_my_get`
- `measurements_my_list`
- `addresses_my_list`
- `quotations_my_list`
- `appointments_my_list`
- `loyalty_my_balance`
- `notifications_my_list`

Also in scope, because the tools cannot work without them:

- Authenticated identity on `/api/chat/route.ts`, which is anonymous
  today, WITHOUT changing the anonymous FAQ and discovery behaviour.
- Extracting the addresses and customer-quotations queries out of their
  page components into `src/lib/` readers, used by both the pages and the
  tools.
- A cross-customer isolation test to the standard of
  `scripts/verify-cross-user.mjs` — two real customers, and the negative
  half carrying the weight.

Explicitly NOT in scope: any customer write tool. Deferred by 12B.16 rule
2, to be authorised separately or not at all.

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

`MODULES 0-31 COMPLETE` + `MODULES 36-41 COMPLETE`

Current Module:

`MODULE 42 — ADMIN AI CHAT INTERFACE — COMPLETE`

Outstanding, in two independent tracks:

- Deployment track: `MODULE 32 — PRODUCTION DEPLOYMENT` (not started),
  then `MODULE 33 — PRODUCTION READINESS & HANDOVER`.
- MCP track (Phase 6, see section 12B/12C): `MODULE 43 — MCP PRODUCTION
  HARDENING & OBSERVABILITY` is COMPLETE (30 August 2026). `MODULE 44 —
  MCP CUSTOMER SELF-SERVICE READ TOOLS` (not started) is unblocked, since
  Module 37 is complete and its read-tool patterns exist to reuse.

  A further MCP module is now scheduled but not numbered: an OAuth 2.1
  authorization server, so this deployment can be added to claude.ai as a
  custom connector. Decided on 30 August 2026 after checking what that
  feature actually requires — the connector dialog takes a URL and an
  optional OAuth client id and secret, and has no field for a bearer
  token, so the endpoint as built could only be added unauthenticated.
  It is scheduled AFTER Module 32, because a connector cannot reach a
  localhost URL. Until then, staff reach the tools through
  `scripts/mcp-stdio.mjs` in Claude Desktop or Claude Code. The reasoning,
  including why it amends 12B.3 rather than extending it, is MCP-029.

  Module 44 inherits one thing from 43 that its own section does not
  mention: the registry has NO `audience` field. 12B.4 says "every tool
  declares an audience" and that has never been true in code — every tool
  is admin-audience by construction, not by declaration. Adding the field,
  and the `visibleTo()` filtering that goes with it, is 44's first job and
  not a detail.

Module 42 was the first module in this track with a user interface and
the first to consume the registry rather than add to it. Its one
non-obvious consequence for 43 and 44: the assistant has never run
against a live model on this deployment, because no `ANTHROPIC_API_KEY`
is set here. Everything it does with a given model output is tested;
nothing proves how the model behaves at the keyboard. Whoever sets the
key first is running the acceptance test, and should do it on a staff
account that holds few permissions, so a wrong answer is cheap.

Module 40 inherits four patterns and should not reinvent them: the write
service lives in `src/lib/<domain>/`, not in the action; a partial update
merges onto the stored record before the domain schema runs; any
transition 12B.6 calls high-risk is its own tool rather than an argument
on an editor; and where the domain has rules, they live in a service both
the admin UI and the tools read, with the UI free to pass
`allowCorrection` and the tools never allowed to.

A WARNING FOR 42, 43 AND 44, now learned three times running. This plan's
description of what already exists has been wrong in each of the last
three modules. 39 was told to reuse workflow validation that did not
exist — three layers of enum checking that looked like validation from a
distance. 40 was specified with a tool for an announcement mechanism
deleted in Module 19, and with an approval workflow that was a sentence
in this plan and nothing in the schema. 41 was specified as four
`analytics` tools, and `analytics.read` turned out to gate one table that
none of the four reads.

Two rules follow, and they are cheap: check what is there before building
on it, and choose a tool's permission from the RLS POLICY on the table it
reads, never from the route gate on the page it resembles. Modules 40 and
41 both found those two disagreeing.

Scope extension recorded, not built: MCP now serves customers as well as
staff. The architecture is documented in 12B.1, 12B.2, 12B.4, 12B.9,
12B.10 and 12B.16, and scheduled as Module 44. No code has been written
for it.

Both open questions are now settled, approved by the developer on
28 August 2026 and marked DECIDED in place:

- Naming: `<domain>_my_<action>` — `orders_my_list`, not `get_my_orders`
  (12B.9).
- Number and order: Module 44, built after Module 37 so it reuses 37's
  read-tool patterns (12C).

One consequence of the scope extension is recorded rather than decided:
customer tools carry no permission key, because all 23 existing keys mean
"any record" rather than "my record" (12B.4).

Modules 37 to 41 are complete, which is every tool-building module the
roadmap specified, and Module 42 has now consumed them. `MODULE 43` and
`MODULE 44` are both buildable and neither blocks the other.

A FOURTH WRONG PREMISE, and the mildest so far. This plan said the chat
would need "a plain-language rendering of tool results". The model's own
prose is that rendering; a second one built in the UI would have been the
structured result shown twice, once in a sentence and once as JSON. What
the screen actually needed was the opposite — a way to see WHICH tools
ran, since the sentence never says. The transcript lists each call and
opens its arguments on demand.

Modules 34, 35 remain FUTURE PHASE and are out of the current commercial
plan.

Suite housekeeping after Module 36: three scripts were failing on stale
assertions rather than on broken behaviour, and are fixed rather than
muted.

- `verify-rls.mjs` and `test-settings-pass1.mjs` asserted that
  `site_settings` is unreadable by anonymous visitors. Migration 0019
  (Module 3) deliberately made it public-read, because branding, theme and
  the SEO defaults have to render for every visitor. The assertions only
  ever passed because the table held no rows; the homepage imagery keys
  added in the catalogue work put four rows in and exposed them. They now
  assert what actually protects anything: the table carries no
  credential-shaped keys, a signed-in customer sees no more rows than an
  anonymous one, and neither can write.
- `test-chatbot.mjs` proved "an unmatched discovery query invents nothing"
  by asking for chartreuse — which stopped being an impossible request the
  moment the demo catalogue gained a chartreuse kurti. The unmatched term
  is now generated per run, so it can never be a real product.

Note for future suite runs: the suite must be run against a PRODUCTION
server (`next build` then `next start`), not `next dev`. Three `test-a11y`
checks read the compiled CSS out of the built page and fail on a dev
server, where Next injects styles through JavaScript instead of linking a
stylesheet.

Next Action:

`Start Module 43` or `Start Module 44` (MCP track), or `Start Module 32`
(deployment track)
