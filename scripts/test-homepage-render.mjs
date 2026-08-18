import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const APP_URL = process.env.TEST_APP_URL ?? "http://localhost:3000";
const suffix = Date.now();

console.log("Writing temporary featured content via service role...");

const { data: collection, error: collectionErr } = await admin
  .from("collections")
  .insert({
    name: `Module4TestCollection${suffix}`,
    slug: `module4-test-collection-${suffix}`,
    is_active: true,
    is_featured: true,
    published_at: new Date().toISOString(),
  })
  .select()
  .single();
if (collectionErr) throw collectionErr;

const { data: product, error: productErr } = await admin
  .from("products")
  .insert({
    name: `Module4TestProduct${suffix}`,
    slug: `module4-test-product-${suffix}`,
    base_price: 499,
    currency: "GBP",
    status: "published",
    is_featured: true,
    published_at: new Date().toISOString(),
  })
  .select()
  .single();
if (productErr) throw productErr;

// A real review needs a real customer + order per the FK/RLS shape —
// create a throwaway confirmed user via the admin API (no email sent).
const { data: testUser, error: userErr } = await admin.auth.admin.createUser({
  email: `module4-review-${suffix}@luxury-couture-devtest.local`,
  password: "correct-horse-battery-7",
  email_confirm: true,
});
if (userErr) throw userErr;

const { data: review, error: reviewErr } = await admin
  .from("reviews")
  .insert({
    customer_id: testUser.user.id,
    product_id: product.id,
    rating: 5,
    title: "Module4TestReviewTitle",
    body: "Module4TestReviewBody — exquisite craftsmanship.",
    is_published: true,
    is_featured: true,
  })
  .select()
  .single();
if (reviewErr) throw reviewErr;

console.log("Confirming homepage renders the temporary content...");
const html = await (await fetch(APP_URL + "/")).text();

const checks = [
  ["featured collection renders", html.includes(`Module4TestCollection${suffix}`)],
  ["featured product renders", html.includes(`Module4TestProduct${suffix}`)],
  ["featured testimonial renders", html.includes("Module4TestReviewTitle")],
];
for (const [label, pass] of checks) console.log(`${pass ? "PASS" : "FAIL"} — ${label}`);

console.log("\nTesting newsletter signup via anon key (real Server Action path: plain insert)...");
const newsletterEmail = `module4-newsletter-${suffix}@example.com`;
const insertResult = await anon.from("newsletter_subscribers").insert({ email: newsletterEmail, source: "homepage" });
console.log("anon insert status:", insertResult.status, insertResult.error?.message ?? "OK");

// Re-run to confirm the duplicate-email path fails with 23505 (unique
// violation), not a false RLS violation — the action treats this as
// success, matching real user behavior (re-submitting the same email).
const secondAttempt = await anon.from("newsletter_subscribers").insert({ email: newsletterEmail, source: "homepage" });
console.log(
  "anon re-insert (duplicate) status:",
  secondAttempt.status,
  secondAttempt.error?.code,
  secondAttempt.error?.message ?? "OK"
);

const { data: subscriberRow } = await admin
  .from("newsletter_subscribers")
  .select("*")
  .eq("email", newsletterEmail);
console.log("newsletter row actually persisted:", subscriberRow?.length === 1);

console.log("\nCleaning up...");
await admin.from("reviews").delete().eq("id", review.id);
await admin.auth.admin.deleteUser(testUser.user.id);
await admin.from("products").delete().eq("id", product.id);
await admin.from("collections").delete().eq("id", collection.id);
await admin.from("newsletter_subscribers").delete().eq("email", newsletterEmail);

const [{ data: c }, { data: p }, { data: r }, { data: n }] = await Promise.all([
  admin.from("collections").select("id"),
  admin.from("products").select("id"),
  admin.from("reviews").select("id"),
  admin.from("newsletter_subscribers").select("id"),
]);
console.log(
  `Remaining rows — collections: ${c.length}, products: ${p.length}, reviews: ${r.length}, newsletter_subscribers: ${n.length} (all should be 0)`
);
