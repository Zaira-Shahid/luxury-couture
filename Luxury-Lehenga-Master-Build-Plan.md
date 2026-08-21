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

Status: [ ] NOT STARTED

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

Status: [ ] NOT STARTED

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

Status: [ ] NOT STARTED

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

Status: [ ] NOT STARTED

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

Status: [ ] NOT STARTED

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

Status: [ ] NOT STARTED

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

Status: [ ] NOT STARTED

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

Status: [ ] NOT STARTED

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

Status: [ ] NOT STARTED

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

Status: [ ] NOT STARTED

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

Status: [ ] NOT STARTED

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

Status: [ ] NOT STARTED

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

Status: [ ] NOT STARTED

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

Status: [ ] NOT STARTED

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

Status: [ ] NOT STARTED

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

Status: [ ] NOT STARTED

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

`MODULE 15 COMPLETE`

Current Module:

`MODULE 15 — COMPLETE`

Next Action:

`Start Module 16`
