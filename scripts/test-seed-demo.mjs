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
import { guardDestructive, isProductionDatabase } from "./lib/guard-destructive.mjs";

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

// SKIP ENTIRELY ON PRODUCTION — and do NOT set ALLOW_DESTRUCTIVE to get
// past the guard.
//
// That distinction is the whole point. This script exercises `--clear`,
// which is exactly what wiped the live shop's photographs when the suite
// was run before a deployment. A test that quietly granted itself
// permission would reproduce the incident precisely while reporting
// PASS, so it refuses instead and says why.
//
// Exit 0, not 1: an un-runnable test in this environment is not a
// failure of the code under test, and run-suite.mjs should not report it
// as one. The line below is what a reader sees in the suite output.
if (isProductionDatabase() && process.env.ALLOW_DESTRUCTIVE !== "1") {
  guardDestructive("test-seed-demo.mjs (it runs --clear)", { soft: true });
  console.log("SKIPPED — needs a non-production database. 0 passed, 0 failed");
  process.exit(0);
}

const suffix = Date.now();

function runSeeder(flag) {
  // Pass the acknowledgement down: reaching here means the guard above
  // already decided this run is allowed, and the child seeder has its own
  // identical guard that would otherwise refuse.
  return execFileSync(process.execPath, ["--env-file=.env.local", "scripts/seed-demo.mjs", flag], {
    encoding: "utf8",
    env: { ...process.env, ALLOW_DESTRUCTIVE: "1" },
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
  // PNG *or* JPEG. This asserted PNG only, which was right while every
  // product carried a generated gradient and wrong the moment real
  // photography landed — the Pexels images are JPEGs. What matters is
  // that a real image comes back, not which encoder produced it.
  const isJpeg = bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  check(
    "what comes back is a real image (PNG or JPEG)",
    isPng(bytes) || isJpeg,
    `${bytes.length} bytes, ${isPng(bytes) ? "PNG" : isJpeg ? "JPEG" : "neither"}`
  );
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

// Scoped to the demo products, not the whole table.
//
// This used to count every product_images row in the database and
// compare it to 12, which was only ever correct while the demo store WAS
// the entire catalogue. The Nikkah and Mehndi collections added 26 more
// products with images, so it started failing at 38 — reporting a
// catalogue that had grown as if it were a seeder duplicating rows.
//
// What the test means is "seeding twice does not give a demo product a
// second image", and that is now what it measures.
const { count: imagesAfterSecond } = await admin
  .from("product_images")
  .select("id", { count: "exact", head: true })
  .in("product_id", (afterSecond ?? []).map((p) => p.id));
check(
  "it does not duplicate product images",
  (imagesAfterSecond ?? 0) === DEMO_PRODUCTS.length,
  `${imagesAfterSecond} images across ${afterSecond?.length} demo products`
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

// Restore the REST of the catalogue too — photography and both
// collections.
//
// THIS BLOCK EXISTS BECAUSE IT FAILED IN PRODUCTION USE. The Nikkah
// collection recorded its eight products in the shared demo_seed_items
// manifest, `--clear` above deletes everything that manifest lists, and
// the re-seed only knows the original twelve. So a routine suite run
// silently took the owner's Nikkah section from ten products down to
// two. Nobody noticed until they looked at the shop.
//
// Two fixes were applied, and both are needed:
//
//   1. seed-mehndi.mjs does NOT write to the shared manifest, and
//      seed-nikkah.mjs no longer does either. The demo store's manifest
//      should describe the demo store, not the catalogue built on top
//      of it.
//   2. This block restores them anyway, so an OLD manifest row — or a
//      future collection that makes the same mistake — cannot leave the
//      shop half empty.
//
// Photography now re-attaches from --local (the owner's own files,
// mapped by eye) rather than --fetch. --fetch needs a live Pexels
// request and was failing every run, which is the state that let the
// missing products go unnoticed: one warning line already looked normal.
const restore = [
  ["photography", ["scripts/seed-demo-photos.mjs", "--local"]],
  ["the Nikkah collection", ["scripts/seed-nikkah.mjs", "--seed"]],
  ["the Mehndi collection", ["scripts/seed-collection.mjs", "mehndi", "--seed"]],
  ["the Reception collection", ["scripts/seed-collection.mjs", "reception", "--seed"]],
  ["the Engagement collection", ["scripts/seed-collection.mjs", "engagement", "--seed"]],
];
for (const [label, args] of restore) {
  console.log(`Restoring ${label}...`);
  try {
    execFileSync(process.execPath, ["--env-file=.env.local", ...args], { encoding: "utf8" });
  } catch (error) {
    console.log(`  (restoring ${label} failed: ${error.message.split("\n")[0]})`);
  }
}

// Assert the restore actually worked, rather than trusting it.
//
// The failure this replaces was invisible precisely because it was only
// ever a console warning. A missing collection is now a FAILING TEST.
{
  const { data: nikkahOcc } = await admin
    .from("occasions")
    .select("id")
    .eq("slug", "nikkah")
    .maybeSingle();
  const { data: mehndiOcc } = await admin
    .from("occasions")
    .select("id")
    .eq("slug", "mehndi")
    .maybeSingle();
  const { data: receptionOcc } = await admin
    .from("occasions")
    .select("id")
    .eq("slug", "reception")
    .maybeSingle();
  const { data: engagementOcc } = await admin
    .from("occasions")
    .select("id")
    .eq("slug", "engagement")
    .maybeSingle();
  const { count: nikkahCount } = await admin
    .from("product_occasions")
    .select("product_id", { count: "exact", head: true })
    .eq("occasion_id", nikkahOcc.id);
  const { count: mehndiCount } = await admin
    .from("product_occasions")
    .select("product_id", { count: "exact", head: true })
    .eq("occasion_id", mehndiOcc.id);

  check(
    "the Nikkah collection survives a full seed/clear/re-seed cycle",
    nikkahCount >= 10,
    `${nikkahCount} products tagged nikkah`
  );
  const { count: receptionCount } = await admin
    .from("product_occasions")
    .select("product_id", { count: "exact", head: true })
    .eq("occasion_id", receptionOcc.id);

  check(
    "the Mehndi collection survives a full seed/clear/re-seed cycle",
    mehndiCount >= 22,
    `${mehndiCount} products tagged mehndi`
  );
  const { count: engagementCount } = await admin
    .from("product_occasions")
    .select("product_id", { count: "exact", head: true })
    .eq("occasion_id", engagementOcc.id);

  check(
    "the Reception collection survives a full seed/clear/re-seed cycle",
    receptionCount >= 17,
    `${receptionCount} products tagged reception`
  );
  check(
    "the Engagement collection survives a full seed/clear/re-seed cycle",
    engagementCount >= 7,
    `${engagementCount} products tagged engagement`
  );

  // No published product may be left without a live occasion.
  //
  // Retiring walima/party and rebuilding the engagement section both
  // remove tags, and a product that loses its last one disappears from
  // every occasion chip while still sitting in the catalogue. That is
  // easy to cause and invisible until someone browses by occasion.
  {
    const { data: liveOcc } = await admin.from("occasions").select("id").eq("is_active", true);
    const liveIds = new Set((liveOcc ?? []).map((o) => o.id));
    const { data: allPublished } = await admin
      .from("products")
      .select("id, name")
      .eq("status", "published");
    const { data: allTags } = await admin
      .from("product_occasions")
      .select("product_id, occasion_id");
    const tagged = new Set(
      (allTags ?? []).filter((t) => liveIds.has(t.occasion_id)).map((t) => t.product_id)
    );
    const orphans = (allPublished ?? []).filter((p) => !tagged.has(p.id));
    check(
      "every published product sits under at least one live occasion",
      orphans.length === 0,
      orphans.length ? orphans.map((o) => o.name).join(", ") : "none orphaned"
    );
  }

  // And that they still have real photographs, not regenerated
  // gradients — the other half of what --clear used to destroy.
  const { data: withImages } = await admin
    .from("products")
    .select("slug, product_images(url)")
    .like("slug", "%-mehndi-%");
  const gradients = (withImages ?? []).filter((p) =>
    (p.product_images ?? []).some((i) => i.url.endsWith(".png") && i.url.includes("gradient"))
  );
  check(
    "restored products carry photographs rather than gradients",
    gradients.length === 0,
    `${gradients.length} back on gradients`
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
