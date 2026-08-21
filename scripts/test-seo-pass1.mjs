// Module 20 Pass 1 — technical SEO verification.
//
// Requires the dev server running (npm run dev) and .env.local loaded:
//   node --env-file=.env.local scripts/test-seo-pass1.mjs
//
// Covers: sitemap.xml contents, robots.txt in both indexing states,
// canonical/OG/Twitter tags, Product + BreadcrumbList + Organization
// JSON-LD validity, and the admin `seo_metadata` override precedence.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const appUrl = process.env.APP_URL ?? "http://localhost:3000";
const suffix = Date.now();

let failures = 0;
function check(label, pass) {
  if (!pass) failures += 1;
  console.log(`${pass ? "PASS" : "FAIL"} — ${label}`);
}

async function getHtml(path) {
  const res = await fetch(`${appUrl}${path}`, { redirect: "manual" });
  return { status: res.status, html: await res.text() };
}

/** Pulls every JSON-LD block out of a page and parses it. */
function jsonLdBlocks(html) {
  const blocks = [];
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  let match;
  while ((match = re.exec(html)) !== null) {
    try {
      blocks.push(JSON.parse(match[1].replace(/\\u003c/g, "<")));
    } catch {
      blocks.push({ __parseError: true, raw: match[1] });
    }
  }
  return blocks;
}

function findSchema(blocks, type) {
  return blocks.find((b) => b["@type"] === type);
}

/** Reads a <meta property|name="..." content="..."> value. */
function metaContent(html, key) {
  const re = new RegExp(`<meta[^>]+(?:property|name)="${key}"[^>]*>`, "i");
  const tag = html.match(re)?.[0];
  return tag?.match(/content="([^"]*)"/i)?.[1] ?? null;
}

function canonicalHref(html) {
  const tag = html.match(/<link[^>]+rel="canonical"[^>]*>/i)?.[0];
  return tag?.match(/href="([^"]*)"/i)?.[1] ?? null;
}

async function setIndexing(enabled) {
  await admin
    .from("site_settings")
    .upsert({ key: "seo.indexing_enabled", value: enabled }, { onConflict: "key" });
}

console.log("=== Setup: a published product and an active collection ===");
const { data: testProduct, error: productError } = await admin
  .from("products")
  .insert({
    name: `SEO Test Lehenga ${suffix}`,
    slug: `seo-test-lehenga-${suffix}`,
    sku: `SEO-${suffix}`,
    description: "A test product used to verify Product structured data.",
    base_price: 1250.5,
    currency: "GBP",
    status: "published",
    published_at: new Date().toISOString(),
  })
  .select()
  .single();
if (productError) throw new Error(`product insert failed: ${productError.message}`);

const { data: testImage } = await admin
  .from("product_images")
  .insert({
    product_id: testProduct.id,
    url: "https://example.com/seo-test.jpg",
    alt_text: "SEO test image alt",
    is_primary: true,
    sort_order: 0,
  })
  .select()
  .single();

const { data: testCollection } = await admin
  .from("collections")
  .insert({
    name: `SEO Test Collection ${suffix}`,
    slug: `seo-test-collection-${suffix}`,
    description: "A test collection.",
    is_active: true,
    published_at: new Date().toISOString(),
  })
  .select()
  .single();

// Indexing on, so robots.txt/meta reflect the live-site configuration.
const { data: priorIndexing } = await admin
  .from("site_settings")
  .select("value")
  .eq("key", "seo.indexing_enabled")
  .maybeSingle();
await setIndexing(true);

console.log("\n=== sitemap.xml ===");
const sitemapRes = await fetch(`${appUrl}/sitemap.xml`);
const sitemapXml = await sitemapRes.text();
check("/sitemap.xml returns 200", sitemapRes.status === 200);
check(
  "content-type is XML",
  (sitemapRes.headers.get("content-type") ?? "").includes("xml")
);
check("lists the published product", sitemapXml.includes(`/products/${testProduct.slug}`));
check("lists the active collection", sitemapXml.includes(`/collections/${testCollection.slug}`));
check("lists the home page", sitemapXml.includes("<loc>") && sitemapXml.includes("/products<"));
for (const priv of ["/admin", "/account", "/checkout", "/cart", "/unsubscribe"]) {
  check(`does NOT list ${priv}`, !sitemapXml.includes(`${priv}<`));
}

console.log("\n=== A draft product must never reach the sitemap ===");
const { data: draftProduct } = await admin
  .from("products")
  .insert({
    name: `SEO Draft ${suffix}`,
    slug: `seo-draft-${suffix}`,
    base_price: 100,
    currency: "GBP",
    status: "draft",
  })
  .select()
  .single();
const draftSitemap = await (await fetch(`${appUrl}/sitemap.xml`)).text();
check("draft product is absent from sitemap", !draftSitemap.includes(draftProduct.slug));

console.log("\n=== robots.txt (indexing enabled) ===");
const robotsOn = await (await fetch(`${appUrl}/robots.txt`)).text();
check("allows crawling", /Allow: \//.test(robotsOn));
check("disallows /admin", robotsOn.includes("Disallow: /admin"));
check("disallows /account", robotsOn.includes("Disallow: /account"));
check("disallows /api", robotsOn.includes("Disallow: /api"));
check("references the sitemap", robotsOn.includes("/sitemap.xml"));

console.log("\n=== robots.txt (indexing disabled — pre-launch safety) ===");
await setIndexing(false);
const robotsOff = await (await fetch(`${appUrl}/robots.txt`)).text();
check("blocks the entire site", /Disallow: \/\s*$/m.test(robotsOff));
check("omits the sitemap reference", !robotsOff.includes("/sitemap.xml"));
const { html: noindexHtml } = await getHtml(`/products/${testProduct.slug}`);
check(
  "pages carry a noindex robots meta tag while indexing is off",
  (metaContent(noindexHtml, "robots") ?? "").includes("noindex")
);
await setIndexing(true);

console.log("\n=== Product detail page: metadata tags ===");
const { status: pdpStatus, html: pdpHtml } = await getHtml(`/products/${testProduct.slug}`);
check("PDP returns 200", pdpStatus === 200);
check(
  "canonical points at the product URL",
  canonicalHref(pdpHtml)?.endsWith(`/products/${testProduct.slug}`) === true
);
check("og:title is the product name", metaContent(pdpHtml, "og:title") === testProduct.name);
check("og:type is website", metaContent(pdpHtml, "og:type") === "website");
check("og:url is absolute", (metaContent(pdpHtml, "og:url") ?? "").startsWith("http"));
check("og:image uses the primary product image", metaContent(pdpHtml, "og:image") === testImage.url);
check(
  "twitter:card is summary_large_image when an image exists",
  metaContent(pdpHtml, "twitter:card") === "summary_large_image"
);
check(
  "robots meta allows indexing",
  (metaContent(pdpHtml, "robots") ?? "index").includes("index") &&
    !(metaContent(pdpHtml, "robots") ?? "").includes("noindex")
);

console.log("\n=== Product detail page: structured data ===");
const pdpBlocks = jsonLdBlocks(pdpHtml);
check("every JSON-LD block parses as valid JSON", pdpBlocks.every((b) => !b.__parseError));
const product = findSchema(pdpBlocks, "Product");
check("emits a Product schema", Boolean(product));
check("Product name matches", product?.name === testProduct.name);
check("Product sku matches", product?.sku === testProduct.sku);
check("Offer price matches base_price", product?.offers?.price === "1250.50");
check("Offer currency matches", product?.offers?.priceCurrency === "GBP");
check("Offer url is absolute", (product?.offers?.url ?? "").startsWith("http"));
check("Product image is present", Array.isArray(product?.image) && product.image.length > 0);
check(
  "no aggregateRating is invented when there are no reviews",
  product?.aggregateRating === undefined
);

const crumbs = findSchema(pdpBlocks, "BreadcrumbList");
check("emits a BreadcrumbList", Boolean(crumbs));
check("breadcrumb has 3 levels (Home > Products > product)", crumbs?.itemListElement?.length === 3);
check(
  "breadcrumb positions are 1-indexed and ordered",
  crumbs?.itemListElement?.every((item, i) => item.position === i + 1) === true
);
check(
  "breadcrumb items are absolute URLs",
  crumbs?.itemListElement?.every((item) => String(item.item).startsWith("http")) === true
);
check("breadcrumb trail is visible in the markup", pdpHtml.includes('aria-label="Breadcrumb"'));

console.log("\n=== Home page: site identity schema ===");
const { html: homeHtml } = await getHtml("/");
const homeBlocks = jsonLdBlocks(homeHtml);
check("emits an Organization schema", Boolean(findSchema(homeBlocks, "Organization")));
check("emits a WebSite schema", Boolean(findSchema(homeBlocks, "WebSite")));
check(
  "Organization url is absolute",
  String(findSchema(homeBlocks, "Organization")?.url ?? "").startsWith("http")
);
// Next.js normalises a root canonical against metadataBase and drops the
// trailing slash ("http://host/" -> "http://host"), so accept either form;
// what matters is that it is the origin with no path.
const homeCanonical = canonicalHref(homeHtml);
check(
  "home canonical is the site root (no path)",
  Boolean(homeCanonical) && new URL(homeCanonical).pathname === "/"
);

console.log("\n=== Collection page ===");
const { status: colStatus, html: colHtml } = await getHtml(`/collections/${testCollection.slug}`);
check("collection page returns 200", colStatus === 200);
check(
  "collection canonical is correct",
  canonicalHref(colHtml)?.endsWith(`/collections/${testCollection.slug}`) === true
);
check("collection og:title matches", metaContent(colHtml, "og:title") === testCollection.name);
check(
  "collection breadcrumb has 3 levels",
  findSchema(jsonLdBlocks(colHtml), "BreadcrumbList")?.itemListElement?.length === 3
);

console.log("\n=== Admin seo_metadata overrides take precedence ===");
const overrideTitle = `Overridden Title ${suffix}`;
const overrideDescription = `Overridden description ${suffix}`;
const overrideCanonical = "https://example.com/canonical-override";
await admin.from("seo_metadata").insert({
  entity_type: "product",
  entity_id: testProduct.id,
  meta_title: overrideTitle,
  meta_description: overrideDescription,
  og_image_url: "https://example.com/override-og.jpg",
  canonical_url: overrideCanonical,
});

const { html: overriddenHtml } = await getHtml(`/products/${testProduct.slug}`);
check("override title wins over the product name", metaContent(overriddenHtml, "og:title") === overrideTitle);
check(
  "override description wins",
  metaContent(overriddenHtml, "og:description") === overrideDescription
);
check("override canonical wins", canonicalHref(overriddenHtml) === overrideCanonical);
check(
  "override OG image wins over the product photo",
  metaContent(overriddenHtml, "og:image") === "https://example.com/override-og.jpg"
);
check(
  "the <title> tag reflects the override",
  overriddenHtml.includes(`<title>${overrideTitle}`)
);

console.log("\n=== JSON-LD escaping (script-breakout safety) ===");
await admin
  .from("products")
  .update({ name: `Evil </script><script>alert(1)</script> ${suffix}` })
  .eq("id", testProduct.id);
const { html: evilHtml } = await getHtml(`/products/${testProduct.slug}`);
check(
  "a product name containing </script> does not break out of the JSON-LD block",
  !evilHtml.includes("</script><script>alert(1)")
);
check("JSON-LD still parses after escaping", jsonLdBlocks(evilHtml).every((b) => !b.__parseError));

console.log("\nCleaning up...");
await admin.from("seo_metadata").delete().eq("entity_id", testProduct.id);
await admin.from("product_images").delete().eq("product_id", testProduct.id);
await admin.from("products").delete().in("id", [testProduct.id, draftProduct.id]);
await admin.from("collections").delete().eq("id", testCollection.id);
if (priorIndexing) {
  await setIndexing(priorIndexing.value === true);
} else {
  await admin.from("site_settings").delete().eq("key", "seo.indexing_enabled");
}

const [{ data: remainingProducts }, { data: remainingSeo }] = await Promise.all([
  admin.from("products").select("id"),
  admin.from("seo_metadata").select("id"),
]);
console.log(
  `Remaining — products: ${remainingProducts.length}, seo_metadata: ${remainingSeo.length} (should reflect pre-existing state only)`
);

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
