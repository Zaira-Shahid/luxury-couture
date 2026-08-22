# Email Guide

What the site sends, who it sends to, and how to switch on real delivery.

---

## It works right now, sending nothing

With no configuration, every email is **logged instead of sent**. The whole application runs, every
flow completes, and nothing leaves the building. That is the mock provider, and it is the default.

You will see entries like `[mock email] { to, subject, template, preview }` in the server output.

---

## Turning on real delivery

Set **both** of these:

```
RESEND_API_KEY=re_...
EMAIL_FROM=Luxury Lehenga <orders@yourdomain.com>
```

Get a key from [resend.com](https://resend.com) — the free tier covers a small shop comfortably.
You must verify your sending domain with them first; `EMAIL_FROM` has to be an address on that
domain or every send is rejected.

**Both are required.** A key without a verified sender fails on every message, which is worse than
an honest mock — so the app only switches over when it has both.

**To force the mock back on** without deleting the key: `EMAIL_PROVIDER=mock`.

**Not yet tested against the live API.** No key existed while this was built, so the request shape
follows Resend's documented API and the failure paths are tested, but no real send has been
observed. Send yourself a test before relying on it — the same caveat as Stripe in Module 11 and
Claude in Module 22.

---

## Transactional vs marketing — the important distinction

These are **different types in the code**, not a naming convention, and the difference is legal.

| | Transactional | Marketing |
| --- | --- | --- |
| Examples | order confirmed, payment received, shipping update, quotation ready | campaigns, abandoned-cart recovery |
| Needs consent? | **No** — it is a record of something the customer did | **Yes** |
| Unsubscribe link | **Never** | **Always** |
| Sent to opted-out customers? | **Yes** | **Never** |

Someone who opts out of marketing still gets their own order updates. Opting out of promotional
email is not opting out of knowing where your order is — and offering to unsubscribe from an order
confirmation would be wrong.

**The rule is enforced structurally.** A marketing message *requires* an unsubscribe URL to be
constructed at all, and the marketing layout injects the link itself. A future campaign feature
cannot forget it, because code that forgets it does not compile.

---

## The unsubscribe model

There are two independent opt-out schemes, because there are two kinds of recipient:

- **Newsletter subscribers** — people who gave an email address without creating an account. Token
  on `newsletter_subscribers` (Module 19).
- **Customers** — people with accounts, reachable by the VIP / new / at-risk campaign targets.
  `profiles.marketing_opt_out` plus a token, added in Module 24.

Both use `/unsubscribe?token=…`, work without signing in, and are honoured on **every** campaign
target.

**Why the page never says whether your token was valid:** it responds identically to a real token
and an invented one ("if that address was subscribed…"). Otherwise anyone could feed it tokens and
learn which addresses are registered with you. The wording is conditional so it stays
non-disclosing without claiming something untrue.

> **Fixed in Module 24.** Module 19 shipped campaign sending with **no unsubscribe link at all**,
> and customer-segment campaigns applied **no opt-out check whatsoever** — an unsubscribed customer
> would still have been emailed. Both are closed. A third defect went with them: the recipient
> lookup silently stopped at 200 users, so a campaign to a larger list quietly missed people.

---

## The templates

Twelve kinds, in `src/lib/email/templates.ts`:

**Transactional** — welcome · enquiry confirmation · quotation · order confirmation · deposit
confirmation · production update · shipping update · balance reminder · delivery · review request

**Marketing** — abandoned cart · promotional campaign

Copy is kept deliberately close to `src/lib/notifications/templates.ts`, which drives the in-app
notification feed, so a customer reading the notification and the email sees the same thing.

**Emails state real prices and real order references.** That is correct: they render facts from the
database. (Module 22's AI guardrails redact all prices and dates — that is for *generated* prose,
and is deliberately not applied here. An order confirmation that hid the amount paid would be
useless.)

### Branding

Emails use your logo and brand name from **Admin → Settings**, so changing them there changes the
emails too. The layout is old-fashioned on purpose — nested tables, inline styles, 600px fixed
width — because Outlook renders through Word's engine and modern CSS layout does not work there.

**Not tested in a real client matrix.** The constructions used are the ones that survive Outlook,
Gmail and Apple Mail, but nobody has opened one in each. Worth a pass before launch.

---

## Seeing what was sent

Every send is recorded in `email_deliveries`: recipient, template, subject, provider,
success/failure, and the error when one occurred. Admin-only, at the database level.

Useful when a customer says they never received something, and it makes a broken provider visible
instead of silent — a failed send is a row, not just a log line that scrolled away.

---

## Known limitations

- **No retry.** A failed send is recorded and logged, not retried. Worth adding a queue when real
  volume justifies it.
- **The welcome email arrives alongside Supabase's own confirmation email.** Merging them means
  customising Supabase's auth email template in their dashboard — configuration, not code.
- **WhatsApp is still mocked.** Only email got a real provider in this module.
- Resend and the client matrix are both unverified, as noted above.
