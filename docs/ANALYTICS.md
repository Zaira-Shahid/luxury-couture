# Analytics & Privacy Guide

How visitor tracking works on this site, what it collects, and the one thing you must do before
launch.

---

## ⚠️ Before launch

1. **Write a privacy policy.** The consent banner links to `/privacy`, which does not exist yet.
   Create it in **Admin → Content → New Page** with the slug `privacy`. It must say what you
   collect, why, how long you keep it, and how someone contacts you to have it deleted.
2. **Set `CRON_SECRET`.** Without it, `/api/cron/purge-analytics` — which *deletes data* — accepts
   unauthenticated requests. Vercel sets this automatically when a cron is configured, but confirm
   it.
3. Decide whether you actually want advertising pixels (see below). You do not have to.

---

## What gets collected

Only from visitors who **actively accept analytics cookies**. Nothing is collected by default.

Thirteen events, defined once in `src/lib/analytics/events.ts`:

| Event | Fired when |
| --- | --- |
| `page_view` | any storefront page is viewed |
| `product_view` | a product page is opened |
| `builder_started` / `builder_completed` | a custom design is begun / submitted for a quotation |
| `inspiration_uploaded` | an inspiration image is added to a design |
| `enquiry_submitted` | the product enquiry form is sent |
| `consultation_booked` | a consultation is booked |
| `add_to_cart` | a product or custom design is added to the cart |
| `checkout_started` | the checkout page is reached |
| `payment_started` / `payment_completed` | Stripe checkout is opened / confirmed by webhook |
| `purchase` | an order is placed |
| `wishlist_action` | an item is added to or removed from a wishlist |

Each row stores the event name, a random session ID, the customer ID **if they are signed in**, and
a small properties object (e.g. which product). **No IP addresses, no device fingerprints, no
names or emails.**

Admin and account areas are not tracked at all — that is staff and customer tooling, not a customer
journey, and excluding it keeps internal traffic out of the funnel.

### The one exception, stated plainly

`purchase` and `payment_completed` are recorded **even without consent**, with the session ID left
empty. They restate facts already stored in `orders` and `payments`, store nothing on the
visitor's device, and cannot be linked back to a browsing session. Without them the funnel's final
step would always read zero. The funnel counts **distinct sessions**, so these consent-less rows
appear in totals and never distort a conversion rate.

---

## The consent model

Three categories, matching UK GDPR and PECR:

| Category | Default | Covers |
| --- | --- | --- |
| **Strictly necessary** | Always on | Cart session, sign-in, security. PECR exempts these — the site cannot work without them. |
| **Analytics** | **Off** | This site's own event collection, described above. |
| **Marketing** | **Off** | Google / Meta / TikTok advertising pixels. |

Requirements this satisfies, which are legal obligations rather than design preferences:

- **"Reject all" is as prominent as "Accept all."** Burying the reject option invalidates consent.
- **Nothing is pre-ticked.** A pre-ticked box is not consent.
- **Consent is withdrawable as easily as it is given** — the "Cookie preferences" link is in the
  footer of every page. Withdrawing analytics consent **deletes** the session cookie rather than
  just ignoring it.
- **The date of consent is stored**, as evidence.
- If the categories ever change, bump `CONSENT_VERSION` in `src/lib/analytics/consent.ts`. Consent
  is then re-collected from everyone rather than silently carried over.

### Cookies this sets

| Cookie | Category | Life | Purpose |
| --- | --- | --- | --- |
| `consent` | Necessary | 1 year | Remembers the choice above |
| `analytics_session` | Analytics | 30 min rolling | Groups one visit's events together |

`analytics_session` is deliberately **separate from the `cart_session` cookie**. Reusing the cart
cookie would have converted a strictly-necessary cookie into one requiring consent, which would
mean asking permission before someone could use a shopping cart.

---

## Advertising pixels (optional, off)

Google Analytics 4, Meta Pixel and TikTok Pixel are wired up but **load only when both** the
visitor granted marketing consent **and** the relevant environment variable is set:

```
NEXT_PUBLIC_GA_MEASUREMENT_ID=
NEXT_PUBLIC_META_PIXEL_ID=
NEXT_PUBLIC_TIKTOK_PIXEL_ID=
```

All blank by default, so nothing third-party loads at all. Leave them blank unless you actively
want that vendor. Each one you enable shares visitor data with that company, which your privacy
policy must then disclose.

**These are untested against real accounts** — no credentials exist. Verify with each vendor's own
debug tool before relying on the numbers.

---

## Data retention

Raw events are deleted automatically after **14 months** by `/api/cron/purge-analytics`, run
monthly. 14 months matches Google Analytics' own default and is the shortest window that still
allows a full year-over-year comparison — which matters here, because bridal demand is strongly
seasonal.

To change it, edit `RETENTION_MONTHS` in `src/app/api/cron/purge-analytics/route.ts`.

---

## Reading the numbers

**Admin → Analytics.** Business figures (revenue, orders, production) live on the **Dashboard**
instead; this screen is only about visitor behaviour.

- **Conversion funnel** — product view → add to cart → checkout → purchase, counted by *distinct
  session*, so one visitor browsing ten products counts once.
- **Trends** — one small chart per funnel step, each on its own scale. They are deliberately not
  combined into a single chart: product views outnumber purchases by an order of magnitude, so a
  shared axis would flatten the step you most want to watch.
- **Most viewed products**, **all events**, and a **recent activity** log.

**These figures undercount real traffic, by design.** Only consenting visitors are measured.
Typical acceptance rates run well below 100%, so treat the numbers as a representative sample and
watch trends and ratios rather than absolute totals. Use them for comparison, never for
reconciliation — for actual sales figures, use the Dashboard, which reads the order records.

---

## Handling a data request

Someone asking what you hold on them, or asking for deletion:

- Signed-in customers: their events carry `profile_id`. Deleting their account sets it to null
  (`on delete set null`), which anonymises their history rather than leaving it attributed.
- Anonymous visitors: only a random session ID is stored, with nothing linking it to a person, so
  there is nothing to look up or return.

---

## Known limitations

- `/api/analytics` validates every event but is **not rate-limited** — the table allows inserts
  from anyone (that is how anonymous visitors get measured), so a determined actor could inflate
  counts. Flagged for Module 29 (security audit).
- Bot filtering is a basic user-agent check, not a maintained bot list.
- Pixels are unverified against real vendor accounts.
