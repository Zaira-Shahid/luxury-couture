// Module 31 — verification for the demo store seeder.
//
// The assertion that matters most is the DESTRUCTIVE one: --clear must
// remove exactly what --seed created and nothing else. A seeder you
// cannot safely reverse is worse than no seeder, because the demo data
// then lives in the real database forever.
//
// So this test plants a hand-made product and a hand-made page ALONGSIDE
// the demo data, runs --clear, and asserts they survive. That is the
// property an owner actually needs before running --clear on anything
// they care about.
//
//   node --env-file=.env.local scripts/test-seed-demo.mjs
//
// Needs a running production server. NOTE: this script seeds and clears
// the demo store as part of running, so it leaves the database in
// whatever state it found it — see the end.
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";

import { generatePlaceholderPng, isPng } from "./lib/placeholder-image.mjs";
import { DEMO_PAGES, DEMO_PRODUCTS } from "./lib/demo-content.mjs";

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

function runSeeder(flag) {
  return execFileSync(process.execPath, ["--env-file=.env.local", "scripts/seed-demo.mjs", flag], {
    encoding: "utf8",
  });
}

// =====================================================================
console.log("\n# The image generator");

const png = generatePlaceholderPng("test-seed", 400, 500);
check("it produces a valid PNG signature", isPng(png));
check("the image is a sensible size", png.length > 500 && png.length < 200_000, `${png.length} bytes`);

// Deterministic output matters: re-running the seeder must not silently
// reshuffle every product's artwork.
const again = generatePlaceholderPng("test-seed", 400, 500);
check("the same seed produces byte-identical output", png.equals(again));

const different = generatePlaceholderPng("another-seed", 400, 500);
check("a different seed produces a different image", !png.equals(different));

check("it is NOT an SVG", !png.subarray(0, 200).toString("utf8").includes("<svg"));

// =====================================================================
console.log("\n# Seeding");

runSeeder("--seed");

const { data: seededProducts } = await admin
  .from("products")
  .select("id, slug, status")
  .in("slug", DEMO_PRODUCTS.map((p) => p.slug));
check(
  "every demo product exists",
  seededProducts?.length === DEMO_PRODUCTS.length,
  `${seededProducts?.length}/${DEMO_PRODUCTS.length}`
);
check(
  "demo products are published",
  (seededProducts ?? []).every((p) => p.status === "published")
);

const { count: manifestCount } = await admin
  .from("demo_seed_items")
  .select("id", { count: "exact", head: true });
check("the manifest recorded what was created", (manifestCount ?? 0) > 40, `${manifestCount} rows`);

// The /privacy page has been a launch blocker since Module 21: the
// cookie banner and the chat widget both link to it and it did not exist.
const { data: privacyPage } = await admin
  .from("pages")
  .select("slug, status, content")
  .eq("slug", "privacy")
  .maybeSingle();
check("the /privacy page now exists", !!privacyPage);
check("it is published", privacyPage?.status === "published");
check(
  "it is honestly marked as an unreviewed draft",
  (privacyPage?.content ?? "").includes("DRAFT"),
  "a privacy policy needs a solicitor before launch"
);
check(
  "it describes data this app actually collects, not a generic template",
  ["measurements", "hash of your IP", "fourteen months"].every((phrase) =>
    (privacyPage?.content ?? "").includes(phrase)
  )
);

// =====================================================================
console.log("\n# Testimonials read as real");

const { data: reviews } = await admin.from("reviews").select("rating, is_published");
const ratings = (reviews ?? []).map((r) => r.rating);
check("testimonials were seeded", ratings.length >= 8, `${ratings.length}`);
check("they are published", (reviews ?? []).every((r) => r.is_published));
// A wall of five stars reads as fabricated to anyone who has shopped
// online, and a demo store that looks fake teaches the owner nothing.
check(
  "the ratings are NOT all five stars",
  new Set(ratings).size > 1,
  `ratings present: ${[...new Set(ratings)].sort().join(", ")}`
);

// =====================================================================
console.log("\n# Images are served, and from an allowed host");

const { data: image } = await admin
  .from("product_images")
  .select("url")
  .eq("is_primary", true)
  .limit(1)
  .maybeSingle();
check("a product has a primary image", !!image?.url);

if (image?.url) {
  // Module 28 restricted next/image to the Supabase host and Module 29's
  // CSP restricted img-src to the same. An image anywhere else would
  // break the page twice over, which is why no external placeholder
  // service was used.
  const host = new URL(image.url).host;
  check("the image is hosted on Supabase Storage", host.endsWith(".supabase.co"), host);

  const res = await fetch(image.url);
  check("the image is publicly fetchable", res.status === 200, `status ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  check("what comes back is a real PNG", isPng(bytes), `${bytes.length} bytes`);
}

// =====================================================================
console.log("\n# The storefront renders the demo store");

const listing = await fetch(`${APP_URL}/products`);
const listingHtml = (await listing.text()).replaceAll("<!-- -->", "");
check("the product listing renders", listing.status === 200);
check("a demo product appears on it", listingHtml.includes(DEMO_PRODUCTS[0].name));

const privacy = await fetch(`${APP_URL}/privacy`);
check("the /privacy page now resolves", privacy.status === 200, `status ${privacy.status}`);

// =====================================================================
console.log("\n# --seed is idempotent");

runSeeder("--seed");

const { data: afterSecond } = await admin
  .from("products")
  .select("id")
  .in("slug", DEMO_PRODUCTS.map((p) => p.slug));
check(
  "running --seed twice does not duplicate products",
  afterSecond?.length === DEMO_PRODUCTS.length,
  `${afterSecond?.length}`
);

const { count: imagesAfterSecond } = await admin
  .from("product_images")
  .select("id", { count: "exact", head: true });
check(
  "it does not duplicate product images",
  (imagesAfterSecond ?? 0) === DEMO_PRODUCTS.length,
  `${imagesAfterSecond}`
);

// =====================================================================
console.log("\n# --clear removes ONLY what it created");

// The whole point. A hand-made product and page, created outside the
// seeder and therefore absent from the manifest, must survive.
const { data: realProduct } = await admin
  .from("products")
  .insert({
    name: `Real Product ${suffix}`,
    slug: `real-product-${suffix}`,
    base_price: 999,
    status: "published",
    published_at: new Date().toISOString(),
  })
  .select("id")
  .single();

const { data: realPage } = await admin
  .from("pages")
  .insert({ title: `Real Page ${suffix}`, slug: `real-page-${suffix}`, content: "x", status: "published" })
  .select("id")
  .single();

const { data: realUser } = await admin.auth.admin.createUser({
  email: `real-owner-${suffix}@luxury-couture-devtest.local`,
  password: `real-owner-${suffix}`,
  email_confirm: true,
});

runSeeder("--clear");

const { data: survivingProduct } = await admin
  .from("products")
  .select("id")
  .eq("id", realProduct.id);
check(
  "a hand-made product SURVIVES --clear",
  (survivingProduct?.length ?? 0) === 1,
  "a real product has no manifest entry, so it is never a candidate"
);

const { data: survivingPage } = await admin.from("pages").select("id").eq("id", realPage.id);
check("a hand-made page SURVIVES --clear", (survivingPage?.length ?? 0) === 1);

const { data: survivingUser } = await admin.auth.admin.getUserById(realUser.user.id);
check("a real account SURVIVES --clear", !!survivingUser?.user);

const { data: clearedProducts } = await admin
  .from("products")
  .select("id")
  .in("slug", DEMO_PRODUCTS.map((p) => p.slug));
check("every demo product is gone", (clearedProducts?.length ?? 0) === 0, `${clearedProducts?.length} left`);

const { data: clearedPages } = await admin
  .from("pages")
  .select("id")
  .in("slug", DEMO_PAGES.map((p) => p.slug));
check("every demo page is gone", (clearedPages?.length ?? 0) === 0);

const { count: manifestAfterClear } = await admin
  .from("demo_seed_items")
  .select("id", { count: "exact", head: true });
check("the manifest is empty afterwards", (manifestAfterClear ?? 0) === 0, `${manifestAfterClear} rows`);

const { data: leftoverFiles } = await admin.storage.from("media").list("demo-store", { limit: 100 });
check(
  "the generated images are removed from storage",
  (leftoverFiles?.length ?? 0) === 0,
  `${leftoverFiles?.length ?? 0} files left`
);

// =====================================================================
console.log("\nCleaning up the test's own fixtures...");
await admin.from("products").delete().eq("id", realProduct.id);
await admin.from("pages").delete().eq("id", realPage.id);
await admin.auth.admin.deleteUser(realUser.user.id);

// Leave the demo store seeded: it is what the storefront is meant to
// show, and a developer running the suite should not find their shop
// emptied as a side effect.
console.log("Re-seeding the demo store (the suite should not empty the shop)...");
runSeeder("--seed");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
