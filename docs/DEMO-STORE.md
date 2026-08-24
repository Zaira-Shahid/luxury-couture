# Demo Store (Module 31)

```
node --env-file=.env.local scripts/seed-demo.mjs --seed     # idempotent
node --env-file=.env.local scripts/seed-demo.mjs --status   # what is seeded
node --env-file=.env.local scripts/seed-demo.mjs --clear    # remove it
```

## What it creates

12 products across 3 categories, 4 collections, 8 testimonials (with the demo customer accounts
`reviews.customer_id` requires), 4 blog posts, 4 CMS pages, 6 gallery images, and a generated
placeholder image for every product, collection and post. **59 tracked rows.**

## Read this before running it on anything you care about

**Demo data in a production database is a liability**, not a feature. Seed a staging project if you
have one. `--clear` is reliable — see below for why — but the safest posture is never needing it.

## Why a script, not a migration

Every other seed in this project is a migration, which is right for **reference** data: a fabric
list is part of what the schema *means*. Demo products are different — you must be able to remove
them before launch, and a migration that inserts demo products is either permanent or needs a
second migration to undo.

## Why `--clear` is safe

Everything the seeder creates is recorded in `demo_seed_items` (`0060`). `--clear` deletes
precisely those rows.

**A real product has no manifest entry, so it is never a candidate for deletion at all.** That is
the whole safety property, and `test-seed-demo.mjs` asserts it directly: it plants a hand-made
product, a hand-made page and a real account alongside the demo data, runs `--clear`, and checks all
three survive.

Two alternatives were rejected:

- **A `demo-` slug prefix.** Slugs are customer-visible URLs, and a demo store at
  `/products/demo-crimson-lehenga` does not look like a real shop — which defeats the point of
  having one.
- **A manifest file on disk.** Lost on a fresh clone or a CI run, after which `--clear` would have
  to guess. A delete that guesses is exactly what must never happen here.

## The images are generated locally, and had to be

No external placeholder service can work here, because of two of this project's own earlier
decisions:

- **Module 28** set `next.config.mjs` `remotePatterns` to the Supabase host only — `next/image`
  **throws** on any other host, taking the page down rather than just the image.
- **Module 29** shipped a CSP with `img-src 'self' data: blob: https://<supabase>` — an external
  image is blocked outright.

So an Unsplash or picsum URL would break the storefront twice over.

`scripts/lib/placeholder-image.mjs` writes PNGs with **no dependencies** — Node's built-in `zlib`
plus about fifteen lines of CRC and chunk framing. A 1200×1500 gradient is roughly 8 kB. They are
deterministic per slug, so re-seeding does not silently reshuffle the catalogue's artwork, and they
use the brand palette from `globals.css` so they read as a considered placeholder rather than a
broken image.

**Not SVG**, which would have been far less code: `validate-file.ts` rejects SVG deliberately as a
stored-XSS vector, and `next/image` refuses to optimise it without `dangerouslyAllowSVG`. Relaxing
either for demo data would be a bad trade.

This also settles the Master Build Plan's "do not use copyrighted brand assets" rule completely —
nothing here is derived from anyone's work, so there is nothing to infringe.

## `/privacy` — a launch blocker, now closed (partly)

The cookie consent banner and the chat widget have both linked to `/privacy` since Module 21, and
**the page did not exist**. The seeder creates it.

**The legal text is a draft and says so on its face.** It is better than a generic template — it
names the data this application actually collects, including measurements, the salted IP hash used
for rate limiting, and the fourteen-month analytics retention. But a privacy policy is a legal
document and this one **needs a solicitor before launch**. The same applies to the seeded terms.

So the blocker moves from "the link 404s" to "the policy needs review". That is progress, not
completion, and it should not be recorded as completion.

## The content is fiction, deliberately signposted

Products, customers and testimonials are invented. Two choices worth keeping:

- **Ratings are not all fives.** A wall of five stars reads as fabricated to anyone who has shopped
  online, and a demo store that looks fake teaches the owner nothing about how the real one will
  look. The fours carry mild, specific criticism — sizing runs small, the dupatta is sheerer than
  expected — which is what genuine positive reviews actually contain.
- **Product copy describes construction, not adjectives.** It reads like a real atelier because
  that is what makes a demo useful for judging layout and tone.

## Verification

`scripts/test-seed-demo.mjs` — 31 checks covering the generator (valid PNG, deterministic, not
SVG), the seed (products published, manifest recorded, `/privacy` present and marked draft),
idempotence (running `--seed` twice does not duplicate), image hosting and public fetchability, the
storefront actually rendering it, and the `--clear` safety property above.

It **re-seeds at the end**, so running the suite does not leave a developer with an emptied shop.
