# Performance & Accessibility (Module 28)

## The honest position on Lighthouse

The Master Build Plan asks for "excellent Lighthouse scores where realistically achievable."
**Lighthouse was not run, and no score is claimed.** Chromium is not installed in this
environment, and a localhost run on a dev machine produces numbers that do not transfer to
production anyway.

Instead, everything on the audit list that *can* be decided deterministically is, by three
scripts that re-run on every suite pass:

| Script | What it settles | Result |
| --- | --- | --- |
| `test-contrast.mjs` | WCAG ratios for every token pair, both themes | 41 / 0 |
| `test-a11y.mjs` | landmarks, labels, alt text, heading order, skip link | 147 / 0 |
| `test-bundle-budget.mjs` | First Load JS per route, against a budget | 13 / 0 |

What remains genuinely unverified here: **field Core Web Vitals** (LCP, CLS, INP as measured on
real devices). Those need a deploy and real traffic. The changes below are the ones known to move
them, but "we made the things that cause bad LCP better" is not the same claim as "LCP is good",
and this document does not make the second one.

## Contrast is arithmetic, so it is checked as arithmetic

`test-contrast.mjs` parses the OKLCH tokens out of `globals.css`, converts through Oklab to
linear sRGB, composites any alpha over its backdrop, and computes WCAG 2.1 ratios.

It found five real failures:

| Pair | Was | Requirement |
| --- | --- | --- |
| light focus ring on page | 2.37:1 | 3:1 (SC 1.4.11) |
| light focus ring on cards | 2.47:1 | 3:1 |
| light sidebar focus ring | under 3:1 | 3:1 |
| light + dark input borders | ~1.3:1 | 3:1 |
| dark destructive button label | 2.77:1 | 4.5:1 (AA) |

The focus ring is the single affordance a keyboard user cannot do without, and it was the worst
offender on the light theme.

**`--border` is reported but not failed**, at 1.27:1 in light. SC 1.4.11 covers visual
information required to *understand or operate* the interface. A decorative hairline between
sections is neither; holding every 1px rule to 3:1 would turn an editorial layout into a
wireframe and would be a misreading of the criterion rather than unusual rigour. The number is
printed on every run so the decision stays visible instead of quietly assumed.

The script also asserts its own maths — white-on-black must compute to 21:1, a colour against
itself to 1:1, 50% white over black to a mid grey. A broken conversion would otherwise bless
everything vacuously.

## Accessibility fixes worth knowing about

- **`(account)` and `(auth)` had no `<main>` landmark at all.** The new skip link had nothing to
  target on the sign-in, password-reset and entire account area.
- **Seven pages shipped no `<h1>`.** Those screens render their heading through `CardTitle`, which
  is a `<div>`. It now takes an optional `as`, defaulting to `div` so no existing usage changed;
  the 23 pages where the card title genuinely is the page title opt in with `as="h1"`.
- **Two hover-only reveal buttons were invisible while focused** — the builder inspiration step
  and the admin media library both used `opacity-0` with only `group-hover:opacity-100`. A
  keyboard user could focus a delete button they could not see. WCAG 2.4.7.
- **Both hand-rolled overlays had no Escape, no dialog semantics and no focus return.** A shared
  `useDialog` hook adds all three.

**Not implemented, stated rather than implied:** `useDialog` does not implement a full focus
trap. Tab can still leave an open overlay for the page behind it. Doing it properly means a
headless dialog primitive or a lot of careful code; both overlays keep a visible Close control, so
nobody is stuck — they can tab somewhere unexpected. This is a real remaining gap.

## Performance: what actually moved

**framer-motion is gone.** A 5.4 MB dependency was being used for three things — a route-change
fade, a scroll reveal, and the hero's staggered entrance. All three are CSS.

| Route | Before | After |
| --- | --- | --- |
| `/` | 173 kB | **129 kB** |
| `/products/[slug]` | 180 kB | **140 kB** |

Removing it also *gained* accessibility: CSS animations obey the `prefers-reduced-motion`
override in `globals.css` automatically. framer-motion's JS-driven transforms did not.

### The hero `<h1>` animates transform only, deliberately

The hero heading is the home page's LCP element. Its previous animation started at
`opacity: 0` — and **an element at opacity 0 has not painted**, so a 0.7s fade pushed Largest
Contentful Paint out by the full length of the animation, on the site's most important route.

It now animates `translateY` only, with opacity left at 1. The element paints on the first frame
and still settles into place. The smaller supporting lines are not LCP candidates and keep their
fade.

### Scroll reveal fails *visible*

`useRevealOnScroll` starts at `data-revealed="true"` and only hides an element once the hook has
mounted and confirmed an observer exists. If JavaScript never runs — disabled, still loading, a
crawler, an unrelated bundle error — the content is simply there.

That is the failure mode scroll-reveal implementations get wrong most often, and getting it wrong
turns a decorative animation into a blank page. Verified: all 16 revealed elements on the home
page render `data-revealed="true"` in the server HTML.

It also skips the hidden state entirely under `prefers-reduced-motion`, and for elements already
on screen at mount — hiding something above the fold just to animate it back reads as a flicker.

### Other changes

- `loading.tsx` for the `(account)` and `(admin)` route groups. The app had exactly one, at the
  root, which renders a full-screen spinner — so every navigation inside the account area blanked
  the whole page including the nav the user had just clicked.
- `next.config.mjs`: AVIF then WebP, and a one-year `minimumCacheTTL`. Safe because these are
  content-addressed Supabase Storage URLs — a changed image gets a new URL, so a long TTL cannot
  serve a stale picture.
- Cart thumbnail on `next/image` with `sizes="64px"`; it was defaulting to `100vw`, downloading a
  full-width source to render a 64px square.

## The bundle budget is a ratchet

`test-bundle-budget.mjs` parses the route table from `next build` and fails if any route exceeds
its budget. Budgets are set from measured post-optimisation numbers with ~10% headroom.

Storefront routes carry the tightest bars because those are what customers land on. Admin routes
are staff tooling behind a login and get a looser one.

**`/auth/callback` has its own 185 kB budget and is deliberately not optimised.** Its weight is
`@supabase/supabase-js`, which genuinely must run client-side: Supabase's email links deliver
tokens in the URL *fragment*, and fragments are never sent to the server. It is an interstitial
seen once per email link for under a second, so it has no Core Web Vitals exposure. That is a
different acceptable weight for a route with a different job — not an exemption, and written down
so it cannot be mistaken for one.

## Deliberately NOT done: cross-request caching of catalogue reads

The approved plan included `unstable_cache` / `revalidate` for catalogue reads. **It was not
implemented**, and the reason is worth recording rather than leaving as an unexplained gap:

- The catalogue fetchers already use `React.cache`, so a single request never re-queries. The
  remaining win is avoiding a Supabase round-trip *between* requests — real, but modest at this
  business's traffic.
- Every storefront route is already dynamic (`ƒ`), because the layout reads `cookies()` for
  consent and `getSiteSettings()` for theming. So ISR is not available; only `unstable_cache`
  around the fetchers is.
- That needs tag-based invalidation wired into ~20 existing `revalidatePath` call sites in
  `admin-catalog/actions.ts`. `revalidatePath` does **not** invalidate an `unstable_cache` entry
  keyed by tag, so a missed site means an admin edits a product and the storefront keeps serving
  the old one.

The trade is a modest latency gain against a user-visible correctness risk on the shop's own
product data, with a verification story that would need building from scratch. If it is wanted
later, the work is: tag each fetcher, add `revalidateTag` beside every existing
`revalidatePath`, and extend `test-module5-catalog.mjs` to assert an admin edit appears on the
storefront immediately.

## Running the checks

```
node scripts/test-contrast.mjs
node --env-file=.env.local scripts/test-a11y.mjs      # needs a running server
npm run build > .m28/build-p2.log 2>&1
node scripts/test-bundle-budget.mjs .m28/build-p2.log
```

`test-bundle-budget.mjs` skips loudly when no build log exists, so the suite records it as 0/0
rather than reporting a false regression for a missing input.
