import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const APP_URL = process.env.TEST_APP_URL ?? "http://localhost:3000";
const suffix = Date.now();

async function check(label, pass) {
  console.log(`${pass ? "PASS" : "FAIL"} — ${label}`);
}

// --- Set up a temporary admin (exercises the same RLS path the real
// admin Server Actions rely on — not bypassing it with service-role
// writes) and a temporary customer.
const { data: adminUser } = await admin.auth.admin.createUser({
  email: `module5-admin-${suffix}@luxury-couture-devtest.local`,
  password: "correct-horse-battery-8",
  email_confirm: true,
});
await admin.from("profiles").update({ role: "admin" }).eq("id", adminUser.user.id);

const { data: customerUser } = await admin.auth.admin.createUser({
  email: `module5-customer-${suffix}@luxury-couture-devtest.local`,
  password: "correct-horse-battery-9",
  email_confirm: true,
});

const adminClient = createClient(url, anonKey);
await adminClient.auth.signInWithPassword({
  email: adminUser.user.email,
  password: "correct-horse-battery-8",
});

const customerClient = createClient(url, anonKey);
await customerClient.auth.signInWithPassword({
  email: customerUser.user.email,
  password: "correct-horse-battery-9",
});

console.log("\n=== Admin catalog CRUD (same RLS path as the real Server Actions) ===");

// createCategory
const { data: category, error: catErr } = await adminClient
  .from("categories")
  .insert({ name: `Module5TestCategory${suffix}`, slug: `module5-test-category-${suffix}`, is_active: true })
  .select()
  .single();
await check("admin can create a category", !catErr && !!category);

// createProduct (+ images + seo)
const { data: product, error: prodErr } = await adminClient
  .from("products")
  .insert({
    name: `Module5TestProduct${suffix}`,
    slug: `module5-test-product-${suffix}`,
    base_price: 799,
    currency: "GBP",
    status: "published",
    is_featured: false,
    category_id: category?.id ?? null,
    published_at: new Date().toISOString(),
  })
  .select()
  .single();
await check("admin can create a product", !prodErr && !!product);

const { error: imgErr } = await adminClient
  .from("product_images")
  .insert({ product_id: product.id, url: "https://example.com/test.jpg", is_primary: true, sort_order: 0 });
await check("admin can add a product image", !imgErr);

const { error: seoErr } = await adminClient
  .from("seo_metadata")
  .upsert(
    { entity_type: "product", entity_id: product.id, meta_title: "Test Meta Title" },
    { onConflict: "entity_type,entity_id" }
  );
await check("admin can upsert product SEO metadata", !seoErr);

// createCollection (+ product link)
const { data: collection, error: colErr } = await adminClient
  .from("collections")
  .insert({
    name: `Module5TestCollection${suffix}`,
    slug: `module5-test-collection-${suffix}`,
    is_active: true,
    published_at: new Date().toISOString(),
  })
  .select()
  .single();
await check("admin can create a collection", !colErr && !!collection);

const { error: linkErr } = await adminClient
  .from("product_collections")
  .insert({ collection_id: collection.id, product_id: product.id });
await check("admin can link product to collection", !linkErr);

// updateProduct-equivalent: toggle featured
const { error: updateErr } = await adminClient
  .from("products")
  .update({ is_featured: true })
  .eq("id", product.id);
await check("admin can update a product", !updateErr);

console.log("\n=== Storefront renders the real admin-created data ===");
const productPageHtml = await (await fetch(`${APP_URL}/products/module5-test-product-${suffix}`)).text();
await check("product detail page renders", productPageHtml.includes(`Module5TestProduct${suffix}`));

const collectionPageHtml = await (await fetch(`${APP_URL}/collections/module5-test-collection-${suffix}`)).text();
await check(
  "collection detail page renders and lists the product",
  collectionPageHtml.includes(`Module5TestCollection${suffix}`) &&
    collectionPageHtml.includes(`Module5TestProduct${suffix}`)
);

const productsListHtml = await (await fetch(`${APP_URL}/products`)).text();
await check("products listing includes the product", productsListHtml.includes(`Module5TestProduct${suffix}`));

const categoryFilterHtml = await (
  await fetch(`${APP_URL}/products?category=module5-test-category-${suffix}`)
).text();
await check(
  "category filter shows the product",
  categoryFilterHtml.includes(`Module5TestProduct${suffix}`)
);

console.log("\n=== Wishlist (owner-scoped) ===");
const { error: wishlistErr } = await customerClient
  .from("wishlist_items")
  .insert({ customer_id: customerUser.user.id, product_id: product.id });
await check("customer can add to wishlist", !wishlistErr);

const { data: wishlistCheck } = await admin
  .from("wishlist_items")
  .select("id")
  .eq("customer_id", customerUser.user.id)
  .eq("product_id", product.id);
await check("wishlist row actually persisted", wishlistCheck?.length === 1);

console.log("\n=== Guest product enquiry (and the 0021 leak fix, exercised for real) ===");
const guestClient = createClient(url, anonKey);
const { error: enquiryErr } = await guestClient.from("enquiries").insert({
  customer_id: null,
  type: "general",
  contact_name: "Module5 Guest",
  contact_email: `module5-guest-${suffix}@example.com`,
  message: `Enquiry about "Module5TestProduct${suffix}" (/products/module5-test-product-${suffix}):\n\nIs this available in red?`,
});
await check("guest can submit a product enquiry", !enquiryErr);

const otherGuestClient = createClient(url, anonKey);
const { data: leakCheck } = await otherGuestClient
  .from("enquiries")
  .select("id")
  .eq("contact_email", `module5-guest-${suffix}@example.com`);
await check("unrelated guest cannot read it back (0021 fix holds)", (leakCheck?.length ?? 0) === 0);

console.log("\nCleaning up...");
await admin.from("wishlist_items").delete().eq("customer_id", customerUser.user.id);
await admin.from("enquiries").delete().eq("contact_email", `module5-guest-${suffix}@example.com`);
await admin.from("product_collections").delete().eq("collection_id", collection.id);
await admin.from("collections").delete().eq("id", collection.id);
await admin.from("seo_metadata").delete().eq("entity_id", product.id);
await admin.from("product_images").delete().eq("product_id", product.id);
await admin.from("products").delete().eq("id", product.id);
await admin.from("categories").delete().eq("id", category.id);
await admin.auth.admin.deleteUser(adminUser.user.id);
await admin.auth.admin.deleteUser(customerUser.user.id);

const [{ data: p }, { data: c }, { data: cat }, { data: w }, { data: e }] = await Promise.all([
  admin.from("products").select("id"),
  admin.from("collections").select("id"),
  admin.from("categories").select("id"),
  admin.from("wishlist_items").select("id"),
  admin.from("enquiries").select("id"),
]);
console.log(
  `Remaining — products: ${p.length}, collections: ${c.length}, categories: ${cat.length}, wishlist_items: ${w.length}, enquiries: ${e.length} (all should be 0)`
);
