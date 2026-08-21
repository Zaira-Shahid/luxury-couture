# SEO Guide

Everything the site does for search engines, and the two things a human still has to do.

---

## ⚠️ Before launch: turn indexing on

**The site is invisible to search engines until you enable it.** This is deliberate — a staging or
pre-launch deploy must never be crawled.

While indexing is off:

- `robots.txt` returns `Disallow: /` for every crawler
- every page sends a `noindex, nofollow` robots meta tag

Both are needed. `robots.txt` alone only stops crawling; it does not remove URLs a search engine
already knows about, and a blocked-but-known URL can still appear in results. The `noindex` tag is
what actually removes it.

**To go live:** Admin → SEO → tick *"Allow search engines to index this site"* → Save.

Verify afterwards by loading `/robots.txt` — it should list `Allow: /` plus the private
`Disallow:` paths and a `Sitemap:` line.

---

## Configuration

| Setting | Where | Notes |
| --- | --- | --- |
| Site URL | `NEXT_PUBLIC_SITE_URL` env var | Must be the real public origin in production. Every canonical URL, Open Graph tag, JSON-LD URL and sitemap entry is built from it. Getting this wrong points search engines at the wrong domain. |
| Default title / description / share image | Admin → SEO | Fallbacks for any page that doesn't set its own. |
| Twitter/X handle | Admin → SEO | Used for `twitter:site` / `twitter:creator`. A missing `@` is added automatically. |
| Google verification token | Admin → SEO | See below. |
| Indexing on/off | Admin → SEO | See the warning above. |
| Per-page overrides | Admin → SEO | Per product, collection, page and journal post. |

---

## How a page's metadata is decided

Every public page builds its metadata through one helper, `buildMetadata()`
(`src/lib/seo/build-metadata.ts`). Each field resolves down this chain, stopping at the first
value that exists:

```
1. Admin override for this exact item   (Admin → SEO → Per-Page Overrides)
2. The item's own field                 (product name, page title, post excerpt…)
3. Site-wide default                    (Admin → SEO → Site Defaults)
4. Hardcoded fallback                   (src/lib/config/site.ts)
```

Because step 4 is a constant, a title or description can never come out empty.

The **canonical URL** follows the same rule: an admin-set canonical wins outright (that's the point
of the field — pointing duplicate or campaign URLs at the real one), otherwise it's the page's own
URL. Note that filtered catalog views (`/products?category=…`) deliberately canonicalise back to
`/products`, so near-duplicate listings don't compete with each other.

---

## Google Search Console setup

1. Deploy the site to its real domain and confirm `NEXT_PUBLIC_SITE_URL` matches it.
2. Go to [search.google.com/search-console](https://search.google.com/search-console) and add a
   property. Choose **URL prefix** and enter the full site URL.
3. Pick the **HTML tag** verification method. Google shows a tag like:

   ```html
   <meta name="google-site-verification" content="AbC123_xyz..." />
   ```

4. Copy **only the `content` value** (`AbC123_xyz...`), not the whole tag.
5. Paste it into Admin → SEO → *Google Search Console verification token* → Save.
6. Load the site and view source to confirm the `google-site-verification` meta tag is present.
7. Back in Search Console, click **Verify**.
8. Once verified, go to **Sitemaps** and submit `sitemap.xml`.

Verification will fail while indexing is disabled if Google cannot fetch the page — enable indexing
first, or verify by DNS instead.

---

## What's generated automatically

- **`/sitemap.xml`** — home, shop, collections, builder, consultations, blog, FAQ and contact, plus
  every published product, active collection, published journal post and published CMS page.
  Drafts, private pages (`/account`, `/admin`, `/cart`, `/checkout`) and `/unsubscribe` are never
  listed. It reads through the same queries the storefront uses, so it can't list something a
  visitor couldn't see.
- **`/robots.txt`** — see the indexing switch above.
- **Structured data (JSON-LD)** — `Organization` and `WebSite` on the home page, `Product` on
  product pages (including a real `aggregateRating` when reviews exist — never a fabricated one),
  `BlogPosting` on journal posts, `FAQPage` on `/faq`, and `BreadcrumbList` on every page with a
  breadcrumb trail.
- **Open Graph and Twitter cards** on every public page.
- **Canonical URLs** on every public page.

### Testing structured data

Paste a public URL into Google's
[Rich Results Test](https://search.google.com/test/rich-results), or view source and look for
`<script type="application/ld+json">`. Locally, `scripts/test-seo-pass1.mjs` and
`scripts/test-seo-pass2.mjs` assert all of it automatically.

---

## Writing content that ranks

- **Slugs are permanent-ish.** Changing a published page's slug changes its URL and loses any
  ranking it had built. Pick well the first time.
- **Excerpts are the meta description.** A journal post's excerpt is what shows under the title in
  search results. Write it for a reader, around 120–160 characters.
- **Alt text.** Product images have an alt-text field in the media library — fill it in. It's both
  an accessibility requirement and how images get found in Google Images.
- **Every page should be linked to.** The footer automatically links every published CMS page, so
  new pages are crawlable as soon as they're published. Orphan pages (in the sitemap but linked
  from nowhere) rank poorly.

---

## Known limitations

- **Page content is plain text, not rich HTML.** Body copy renders as paragraphs split on blank
  lines. This is intentional: rendering stored HTML would make the content editor a stored-XSS
  vector, and adding a markdown renderer plus sanitizer is a dependency decision for its own
  module. Headings and links inside body copy aren't available yet.
- **No sitemap index or pagination.** A single `sitemap.xml` is fine well past 50,000 URLs.
- **Image optimization is partial.** Public storefront images are optimized; admin and account
  screens still use plain `<img>` and are deferred to Module 28, which owns performance.
- **Search Console submission is manual** and needs a real domain — it can't be automated from
  here.
