# Settings Guide

**Admin → Settings** is the control centre. Ten sections, all taking effect immediately.

---

## The one rule worth knowing

**API keys are never stored in the database.** Stripe, Claude, Resend and the cron secret live in
environment variables where you deploy. The Settings screen shows only whether each is *configured*
or *not set* — it cannot display the value, because it never reads it.

That is deliberate. A settings table is readable by every admin and stored unencrypted; live
credentials there would be a real security problem. Everything else — the things that are genuinely
configuration, not credentials — is editable here.

The second rule, less visible but just as important: **every field on this screen actually does
something.** Nothing is stored and ignored. That is why shipping *rate tables* are absent rather
than present-but-inert (see Limitations).

---

## Sections

### General
Brand name, logo, favicon, contact details, **currency**, number format, country, timezone.

Changing the **currency** changes prices across the site and applies to **new** orders. Existing
orders keep the currency they were placed in — a historical invoice must not silently restate
itself.

### Theme
Primary, accent, background and text colours, corner radius, and **typography**.

Colours accept any CSS colour; leaving one blank falls back to the built-in default rather than
rendering nothing. Typography is a **choice between prepared font pairings**, not a font-name box:
fonts are loaded and self-hosted at build time, so a free-text field could not work and would
silently do nothing.

### Store
**Tax rate**, whether prices already include tax, what to call it, and the low-stock threshold.

Tax defaults to **0%**, meaning off. Set a rate and it applies to every new order after discounts:

- **Exclusive** (default) — tax is added on top, the customer pays more.
- **Inclusive** — your listed prices already contain it, the total is unchanged, and the tax is
  shown as a breakdown. This is the usual UK retail presentation.

### Orders
**Deposit percentage**. Defaults to 0%, meaning the full amount is charged at once.

Set it to, say, 50 and cart checkout takes half up front and leaves the balance due before
shipping. Quotations are unaffected — they carry their own per-quote deposit, set when you write
the quote.

### Builder
Whether the custom builder is available at all, and whether an inspiration image is required.
Turning the builder off makes it genuinely absent, not merely hidden.

### Shipping
Free-shipping threshold and a default shipping cost. **Rate tables are not built** — see
Limitations.

### Notifications
Master switches for order/payment emails and for marketing emails. Turning order emails off leaves
customers with the in-app notification feed only. Customer opt-outs are always honoured regardless
of the marketing switch — that switch is *in addition to* them, never instead.

### SEO
Meta description, share image, Twitter handle, Search Console token, and the **indexing switch**.

> ⚠️ **Indexing is OFF by default.** While off, `robots.txt` blocks every crawler and every page
> sends `noindex`. **Turn this on at launch** — see `docs/SEO.md`.

Per-page overrides for individual products and pages live on the separate SEO screen.

### Analytics
Google, Meta and TikTok tracking IDs. These are **public identifiers, not secrets**, so they are
editable here and change without a redeploy. Leave one blank and that vendor never loads at all.
Pixels only load for visitors who accepted marketing cookies.

### AI
Feature switches for the customer assistant and for admin drafting, plus key status. Turning the
assistant off removes it from the storefront entirely — no markup, no JavaScript.

---

## Changing money rules on a live shop

Tax and deposit both default to off, so upgrading changed nothing about your existing totals. When
you do turn one on:

- It affects **new orders only**. What was charged on a past order is recorded on that order and
  never recalculated.
- The checkout page tells the customer before they pay — the tax line and the deposit split are
  both disclosed on the summary.
- Deposits use the payment records that already existed: an order gets a *deposit* payment up
  front, and the balance is collected later.

---

## For developers: adding a setting

One entry in `src/lib/settings/registry.ts` — key, section, type, label, help. Parsing, the admin
form and validation all derive from it. Add the matching field to `SiteSettings` in `types.ts` and
read it through `getSiteSettings()`.

Two constraints:

- `registry.ts`, `format.ts` and `pricing.ts` are **import-free on purpose**, so the test scripts
  can import them directly and so client components can use the formatters. Adding an import that
  reaches `getSiteSettings` will break the build (`next/headers` in a client bundle).
- **Never add a credential.** Put it in `ENV_CREDENTIALS` instead, which reports status only.

---

## Known limitations

- **Shipping rate tables are not built.** There are no zones, weights or per-country rates — only a
  flat default and a free-shipping threshold. A real rate engine belongs with the shipping work,
  not a settings screen, so it was deferred rather than faked with fields that do nothing.
- **Tax is a single flat rate.** No per-product VAT classes, no destination-based rules, no
  reverse-charge handling. Correct for a single-jurisdiction UK shop; international VAT/OSS is a
  separate piece of work.
- **Order and production statuses are code-owned.** They carry workflow and database rules, so they
  are not editable as free text.
- **Fonts are limited to the prepared pairings**, for the build-time reason above.
- Changing currency leaves historical orders in their original currency, so a mixed list is
  expected after a switch. That is correct, but worth knowing before you switch.
