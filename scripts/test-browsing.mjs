// Module 30 — product browsing as a customer journey.
//
// Before this file, browsing was covered only incidentally by
// test-module5-catalog.mjs, which asserts that a product page renders.
// That is not the same as "a customer can find things": filtering,
// searching, combining the two, and — most importantly — NOT being shown
// products that are not for sale.
//
// A FINDING RATHER THAN A TEST: the storefront listing has no pagination
// and no user-controlled sorting. getPublishedProducts() accepts a
// `limit`, but /products never passes one, and there is no offset or
// range anywhere — so every published product is rendered on one page,
// ordered by published_at descending. That is fine for a boutique
// catalogue and will stop being fine at some size. It is reported at the
// end rather than tested, because testing a feature that does not exist
// would be inventing coverage.
//
//   node --env-file=.env.local scripts/test-browsing.mjs
//
// Needs a running production server.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let passed = 0;
let failed = 0;
function check(label, ok, detail) {
  console.log(`${ok ? "PASS" : "FAIL"} — ${label}${detail ? ` (${detail})` : ""}`);
  if (ok) passed += 1;
  else failed += 1;
}

const suffix = Date.now();
const rendered = (html) => html.replaceAll("<!-- -->", "");

async function get(path) {
  const res = await fetch(`${APP_URL}${path}`);
  return { status: res.status, html: rendered(await res.text()) };
}

// ---------------------------------------------------------------------
console.log("\n# Setup — two categories, three products, one unpublished");

const { data: bridal } = await admin
  .from("categories")
  .insert({ name: `Bridal ${suffix}`, slug: `bridal-${suffix}` })
  .select("id, slug")
  .single();
const { data: party } = await admin
  .from("categories")
  .insert({ name: `Party ${suffix}`, slug: `party-${suffix}` })
  .select("id, slug")
  .single();

const products = [];
for (const [name, slug, categoryId, status] of [
  [`Crimson Bridal ${suffix}`, `crimson-bridal-${suffix}`, bridal.id, "published"],
  [`Ivory Bridal ${suffix}`, `ivory-bridal-${suffix}`, bridal.id, "published"],
  [`Emerald Party ${suffix}`, `emerald-party-${suffix}`, party.id, "published"],
  [`Secret Draft ${suffix}`, `secret-draft-${suffix}`, bridal.id, "draft"],
]) {
  const { data } = await admin
    .from("products")
    .insert({
      name,
      slug,
      category_id: categoryId,
      base_price: 1000,
      status,
      published_at: status === "published" ? new Date().toISOString() : null,
    })
    .select("id, name, slug, status")
    .single();
  products.push(data);
}
check("fixtures created", products.every(Boolean), `${products.length} products`);

const [crimson, ivory, emerald, draft] = products;

// ---------------------------------------------------------------------
console.log("\n# The listing shows published products and hides the rest");

const listing = await get("/products");
check("the product listing renders", listing.status === 200, `status ${listing.status}`);
check("a published product appears", listing.html.includes(crimson.name));
check("a second published product appears", listing.html.includes(emerald.name));

// The important one. A draft product leaking onto the storefront is a
// business problem (unfinished pricing, unreleased designs) and is
// exactly the kind of thing an RLS or query change breaks silently.
check("a DRAFT product does NOT appear", !listing.html.includes(draft.name), draft.name);

// ---------------------------------------------------------------------
console.log("\n# Category filtering");

const bridalOnly = await get(`/products?category=${bridal.slug}`);
check("the category page renders", bridalOnly.status === 200);
check("it shows a product in that category", bridalOnly.html.includes(crimson.name));
check("it shows the other product in that category", bridalOnly.html.includes(ivory.name));
check(
  "it EXCLUDES a product from another category",
  !bridalOnly.html.includes(emerald.name),
  emerald.name
);
check("a draft in that category is still hidden", !bridalOnly.html.includes(draft.name));

const partyOnly = await get(`/products?category=${party.slug}`);
check("the other category filters the opposite way", partyOnly.html.includes(emerald.name));
check("and excludes the first category", !partyOnly.html.includes(crimson.name));

// ---------------------------------------------------------------------
console.log("\n# Search");

const search = await get(`/products?q=Crimson`);
check("search returns a matching product", search.html.includes(crimson.name));
check("search excludes a non-matching product", !search.html.includes(emerald.name));

const searchDraft = await get(`/products?q=Secret`);
check(
  "search cannot surface a draft product",
  !searchDraft.html.includes(draft.name),
  "an unpublished product must not be findable by name"
);

// ---------------------------------------------------------------------
console.log("\n# Filters compose, and empty states are handled");

const combined = await get(`/products?category=${party.slug}&q=Crimson`);
check(
  "a category and a search that do not overlap yield neither product",
  !combined.html.includes(crimson.name) && !combined.html.includes(emerald.name)
);

const nonsense = await get(`/products?q=zzzzz-no-such-product-${suffix}`);
check("a search with no results still renders", nonsense.status === 200);
check(
  "it does not render a broken or empty shell",
  nonsense.html.includes("<main") && nonsense.html.length > 500
);

const unknownCategory = await get(`/products?category=no-such-category-${suffix}`);
check("an unknown category does not error", unknownCategory.status === 200);

// ---------------------------------------------------------------------
console.log("\n# Ordering is deterministic");

// Products are ordered by published_at descending. Asserting the ORDER
// rather than mere presence catches a query change that silently drops
// the sort — which would make the listing appear to reshuffle at random.
const { data: reordered } = await admin
  .from("products")
  .update({ published_at: new Date(Date.now() + 60_000).toISOString() })
  .eq("id", emerald.id)
  .select("id")
  .single();
check("a product's published_at can be moved for the test", !!reordered);

const afterReorder = await get("/products");
const emeraldAt = afterReorder.html.indexOf(emerald.name);
const crimsonAt = afterReorder.html.indexOf(crimson.name);
check(
  "the most recently published product appears first",
  emeraldAt !== -1 && crimsonAt !== -1 && emeraldAt < crimsonAt,
  `emerald@${emeraldAt} crimson@${crimsonAt}`
);

// ---------------------------------------------------------------------
console.log("\n# A product detail page");

const detail = await get(`/products/${crimson.slug}`);
check("the detail page renders", detail.status === 200);
check("it names the product", detail.html.includes(crimson.name));

const draftDetail = await fetch(`${APP_URL}/products/${draft.slug}`, { redirect: "manual" });
const draftHtml = rendered(await draftDetail.text());
// notFound() during render returns HTTP 200 in this Next version — a
// characteristic this project has hit before — so the assertion is on
// the CONTENT, not the status code.
check(
  "a draft product's detail page is not viewable",
  draftHtml.includes("Page not found") || !draftHtml.includes(draft.name),
  `status ${draftDetail.status}`
);

// ---------------------------------------------------------------------
console.log("\nCleaning up...");
await admin.from("products").delete().in("id", products.map((p) => p.id));
await admin.from("categories").delete().in("id", [bridal.id, party.id]);

console.log(`\n${passed} passed, ${failed} failed`);
console.log(
  "\nNOTE — the storefront listing has NO pagination and no user-controlled sort."
);
console.log(
  "       Every published product renders on one page, newest first. Fine for a"
);
console.log(
  "       boutique catalogue; worth revisiting before the catalogue grows."
);
process.exit(failed === 0 ? 0 : 1);
