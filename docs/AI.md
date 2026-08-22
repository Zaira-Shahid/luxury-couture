# AI Guide

What the AI layer does, what it is structurally incapable of doing, and how to turn on the
higher-quality mode if you want it.

---

## It works right now, with nothing configured

There is no setup step. With no API key and no account, the site already has:

- **FAQ answering** — matches a customer question against the FAQs you wrote in Admin → Content and
  returns your answer word for word.
- **Product recommendations** — the "you may also like" section on every product page.
- **Draft product descriptions** — the "Write with AI" button on the product form.
- **Draft customer emails** — the "Draft" button on the order page.

This is the **deterministic engine**. It costs nothing, needs no account, and cannot invent
anything, because it never writes a novel sentence — it returns your FAQ text, ranks your products
with arithmetic, and fills templates with your real data.

Its honest weakness is **coverage, not accuracy**. Ask a question worded quite differently from any
FAQ and it will say it doesn't know rather than guess. That is the correct behaviour for a customer
-facing system: a confident wrong answer costs far more than a miss.

---

## Turning on Claude (optional, paid)

Set one environment variable:

```
ANTHROPIC_API_KEY=sk-ant-...
```

Get a key from [console.anthropic.com](https://console.anthropic.com). That's the whole setup.

**What changes:** FAQ answering understands questions worded differently from your FAQs, and the
product/email drafts read as genuine prose rather than filled-in templates.

**What does not change:** every safety rule below still applies, identically. Recommendations stay
on the deterministic engine either way — ranking products by view counts is arithmetic, and paying
a model to redo arithmetic would be slower, costlier and less accurate.

**Cost.** Only two things call the API: an admin pressing a Generate button, and a customer FAQ
question (once Module 23 ships the chatbot). Both are small requests. There is no background or
per-page-view AI usage anywhere — nothing runs unless a person asks for it.

**To turn it off again** without deleting the key, set `AI_PROVIDER=deterministic`.

**If the API fails** — outage, rate limit, bad key, timeout — every feature silently falls back to
the deterministic engine. An AI problem degrades quality; it never takes a page down.

---

## The rules it cannot break

The Master Build Plan sets five hard rules. They are enforced in two different ways, and the
distinction matters.

### Enforced by structure — no code path exists

> AI must never alter payment records · AI must never alter order status · AI must never bypass
> admin controls

The AI layer's interface exposes exactly four things: answer a question, rank products, draft a
description, draft an email. There is no method that takes a table, an id, or a status. **There is
no way to reach the database through it**, so this is not a rule the system tries to follow — it is
a thing it has no mechanism to do.

Both admin buttons are **draft-and-review**: they fill a form field. You then read it, edit it, and
press Save, which runs the same validated save action it always did. Nothing an AI produces reaches
a customer or a record without you putting it there.

### Enforced by inspection — every output is checked

> AI must never invent final prices · AI must never promise delivery dates

Every piece of generated text — from the model *and* from the templates — passes through a
guardrail check before anyone sees it. It redacts:

- **Any monetary amount at all** (`£1,200`, `GBP 750`, `950 pounds`). Not just wrong ones. Once a
  figure is loose in prose we cannot tell an accurate one from an invented one, and this business
  runs on an admin-set *Final Admin Quote*. Prices are shown to customers from the database, where
  they are correct by definition.
- **Any delivery or completion timescale** ("within 3 weeks", "ready by Friday", "dispatched
  tomorrow").
- **Any claim about an order or payment** ("your order has shipped", "payment received").

When something is redacted on an admin draft you will see a note saying so — read the draft before
saving. On customer-facing answers the response is discarded entirely instead, so no customer ever
sees redaction markers.

The model is also *told* these rules, but the check is what enforces them: a prompt is a request,
not a guarantee.

---

## What the AI is allowed to know

Only this, and it is a deliberate allow-list:

- the FAQs you wrote (active ones only)
- published product and category names
- your brand name, description and contact email

**Never** customer names, emails, addresses or measurements; **never** orders, payments,
quotations or production records; **never** prices; **never** anything in draft.

---

## Auditing what it produced

Every generation is logged to the `ai_generations` table — what kind, which provider, a summary of
the request, the output, which guardrails fired, and which admin asked for it. Admin-only, at the
database level. Useful for spot-checking quality and for seeing whether the model is repeatedly
trying to state prices or dates.

---

## How recommendations are chosen

A ranked chain — each step fills whatever slots are still empty:

1. **Bought together** — products appearing in the same orders.
2. **Viewed together** — products viewed in the same visit.
3. **Same category, similar price.**
4. **Same collection.**
5. **Featured, then newest.**

Steps 1–2 need real traffic, so on a new site steps 3–5 do the work; recommendations improve on
their own as the shop gets used.

**On privacy:** steps 1–2 are computed as *product-to-product* totals — "these two items were seen
in the same visit", never "this person looked at these things". No profile of any individual is
built or stored. That keeps it inside the purpose your cookie banner already discloses. If you ever
want genuinely personalised recommendations, that needs its own consent category and a change to
the banner wording — see `docs/ANALYTICS.md`.

---

## Known limitations

- **The Claude integration has not been run against the live API.** No key was available when it was
  built, so its request shapes follow the current SDK documentation and its failure and fallback
  paths are tested with an injected failing client — but the successful-response path is unverified.
  Test it with a real key on a couple of drafts before relying on it. (Same deferral made for PayPal
  and courier APIs in Modules 11 and 14.)
- **Deterministic FAQ matching is word-overlap, not meaning.** "How long does delivery take" will
  not match a FAQ worded "what are your shipping times", because they share no significant words.
  Write FAQ questions the way customers actually phrase them, or turn on Claude.
- **There is no occasion or style taxonomy** in the catalogue (no "bridal" / "mehndi" / "reception"
  tags), so recommendations cannot yet be occasion-based. Module 23 will need either that schema
  work or the Claude provider reasoning over product names.
- Guardrails are pattern-based. They are tested against a wide set of real phrasings, but a
  sufficiently unusual wording could slip through — which is exactly why every AI output goes to a
  human for review rather than straight to a customer.
