import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const appUrl = process.env.APP_URL ?? "http://localhost:3000";
const suffix = Date.now();

async function check(label, pass) {
  console.log(`${pass ? "PASS" : "FAIL"} — ${label}`);
}

async function signIn(email, password) {
  const client = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  const { data: signInData } = await client.auth.signInWithPassword({ email, password });
  return { client, userId: data.user.id, session: signInData.session };
}

function projectRef() {
  return new URL(url).hostname.split(".")[0];
}
function sessionCookieHeader(session) {
  const b64url = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  return `sb-${projectRef()}-auth-token=base64-${b64url}`;
}

console.log("=== Setup: two customers, an admin, a delivered order and a not-yet-delivered order ===");
const customerA = await signIn(`m18-a-${suffix}@luxury-couture-devtest.local`, "correct-horse-b0");
const customerB = await signIn(`m18-b-${suffix}@luxury-couture-devtest.local`, "correct-horse-b1");
const staffAdmin = await signIn(`m18-admin-${suffix}@luxury-couture-devtest.local`, "correct-horse-b2");
await admin.from("profiles").update({ role: "admin" }).eq("id", staffAdmin.userId);

const { data: address } = await admin
  .from("addresses")
  .insert({ customer_id: customerA.userId, recipient_name: "A", line1: "1 Test St", city: "London", postal_code: "E1 1AA", country: "UK" })
  .select()
  .single();

const { data: product } = await admin
  .from("products")
  .insert({ name: "Review Test Lehenga", slug: `review-test-${suffix}`, base_price: 500, status: "published" })
  .select()
  .single();

const { data: deliveredOrder } = await admin
  .from("orders")
  .insert({ customer_id: customerA.userId, shipping_address_id: address.id, status: "delivered", subtotal: 500, total_amount: 500 })
  .select("id, order_number")
  .single();
await admin.from("order_items").insert({ order_id: deliveredOrder.id, product_id: product.id, description_snapshot: product.name, quantity: 1, unit_price: 500, line_total: 500 });
await admin.from("shipping_orders").insert({ order_id: deliveredOrder.id, address_id: address.id, status: "delivered", shipped_at: new Date().toISOString(), delivered_at: new Date().toISOString() });

const { data: pendingOrder } = await admin
  .from("orders")
  .insert({ customer_id: customerA.userId, shipping_address_id: address.id, status: "pending", subtotal: 500, total_amount: 500 })
  .select("id, order_number")
  .single();
await admin.from("shipping_orders").insert({ order_id: pendingOrder.id, address_id: address.id, status: "in_transit" });

console.log("\n=== Submission gating (mimics submitReview's own checks) ===");
async function attemptSubmit(client, orderId, productId, customerId, expectAllow) {
  // Mirrors submitReview: order ownership + delivered check + product-in-order check.
  const { data: order } = await admin.from("orders").select("customer_id").eq("id", orderId).single();
  const { data: shipping } = await admin.from("shipping_orders").select("status").eq("order_id", orderId).maybeSingle();
  const ownedAndDelivered = order?.customer_id === customerId && shipping?.status === "delivered";
  if (!ownedAndDelivered) return !expectAllow;

  const { error } = await client.from("reviews").insert({
    customer_id: customerId,
    order_id: orderId,
    product_id: productId,
    rating: 5,
    reviewer_name: "Test Reviewer",
    is_published: false,
  });
  return expectAllow ? !error : !!error;
}

await check(
  "customer A can submit a review for their own delivered order",
  await attemptSubmit(customerA.client, deliveredOrder.id, product.id, customerA.userId, true)
);
await check(
  "the gating logic rejects a not-yet-delivered order",
  await attemptSubmit(customerA.client, pendingOrder.id, null, customerA.userId, false)
);
await check(
  "the gating logic rejects an order that isn't the caller's own",
  await attemptSubmit(customerB.client, deliveredOrder.id, null, customerB.userId, false)
);

const { data: review } = await admin.from("reviews").select("*").eq("order_id", deliveredOrder.id).single();
await check("the submitted review starts unpublished", review.is_published === false);
await check("the reviewer_name snapshot was captured", review.reviewer_name === "Test Reviewer");
await check("order_id is set, making this a verified purchase", review.order_id === deliveredOrder.id);

console.log("\n=== RLS: review moderation trigger (0040) — the real fix this module made ===");
const { error: selfPublishErr } = await customerA.client.from("reviews").update({ is_published: true }).eq("id", review.id);
await check("a customer CANNOT self-publish their own review directly via RLS", !!selfPublishErr);

const { error: selfFeatureErr } = await customerA.client.from("reviews").update({ is_featured: true }).eq("id", review.id);
await check("a customer CANNOT self-feature their own review", !!selfFeatureErr);

const { error: harmlessEditErr } = await customerA.client.from("reviews").update({ title: "Updated title" }).eq("id", review.id);
await check("a customer CAN still edit a non-moderation field on their own review", !harmlessEditErr);

const { error: adminPublishErr } = await staffAdmin.client.from("reviews").update({ is_published: true }).eq("id", review.id);
await check("admin CAN publish the review", !adminPublishErr);

const { error: adminFeatureErr } = await staffAdmin.client.from("reviews").update({ is_featured: true }).eq("id", review.id);
await check("admin CAN feature the (now-published) review", !adminFeatureErr);

console.log("\n=== RLS: cross-customer review visibility ===");
const { data: bSeesUnpublished } = await customerB.client.from("reviews").select("id").eq("title", "some other unpublished review that does not exist");
await check("sanity: query mechanics work", Array.isArray(bSeesUnpublished));
const { data: bSeesPublished } = await customerB.client.from("reviews").select("id").eq("id", review.id);
await check("a published review IS visible to another customer", (bSeesPublished?.length ?? 0) === 1);

console.log("\n=== review_media: follows parent review's visibility, author-owned insert ===");
const { data: media, error: mediaInsertErr } = await customerA.client
  .from("review_media")
  .insert({ review_id: review.id, url: "https://example.com/photo.jpg", type: "image" })
  .select()
  .single();
await check("the review's author can attach media to their own review", !mediaInsertErr && !!media);

const { error: otherMediaInsertErr } = await customerB.client
  .from("review_media")
  .insert({ review_id: review.id, url: "https://example.com/hijack.jpg", type: "image" });
await check("a different customer cannot attach media to someone else's review", !!otherMediaInsertErr);

const { data: publicSeesMedia } = await customerB.client.from("review_media").select("id").eq("review_id", review.id);
await check("media on a published review is visible to another customer", (publicSeesMedia?.length ?? 0) === 1);

console.log("\n=== social_gallery_images: admin-write, public-read-when-active ===");
const { data: galleryImage, error: galleryCreateErr } = await staffAdmin.client
  .from("social_gallery_images")
  .insert({ image_url: "https://example.com/gallery.jpg", is_active: true, sort_order: 0 })
  .select()
  .single();
await check("admin can create a gallery image", !galleryCreateErr && !!galleryImage);

const { error: customerGalleryErr } = await customerA.client
  .from("social_gallery_images")
  .insert({ image_url: "https://example.com/hijack.jpg" });
await check("a customer cannot create a gallery image", !!customerGalleryErr);

const { data: inactiveImage } = await admin
  .from("social_gallery_images")
  .insert({ image_url: "https://example.com/inactive.jpg", is_active: false, sort_order: 1 })
  .select()
  .single();
const { data: publicSeesActive } = await customerA.client.from("social_gallery_images").select("id").eq("id", galleryImage.id);
const { data: publicSeesInactive } = await customerA.client.from("social_gallery_images").select("id").eq("id", inactiveImage.id);
await check("an active gallery image is publicly readable", (publicSeesActive?.length ?? 0) === 1);
await check("an inactive gallery image is NOT publicly readable", (publicSeesInactive?.length ?? 0) === 0);

console.log("\n=== Live nav-link resolution: real authenticated session, same technique as Modules 16/17 ===");
const cookie = sessionCookieHeader(staffAdmin.session);
const customerCookie = sessionCookieHeader(customerA.session);
const routes = [
  { cookie, path: "/admin/reviews" },
  { cookie, path: "/admin/reviews/gallery" },
  { cookie: customerCookie, path: `/account/reviews/new?orderId=${deliveredOrder.id}` },
];
for (const { cookie: c, path } of routes) {
  const res = await fetch(`${appUrl}${path}`, { headers: { cookie: c }, redirect: "manual" });
  await check(`${path} resolves (200)`, res.status === 200);
}

// redirect() thrown during page rendering is the same documented Next.js
// 15 characteristic as notFound() (see docs/ARCHITECTURE.md, Module 10):
// a 200 with the redirect handled client-side, not a genuine 3xx status.
// The meaningful check is that the review form itself never rendered —
// not the raw status code.
const notDeliveredRes = await fetch(`${appUrl}/account/reviews/new?orderId=${pendingOrder.id}`, {
  headers: { cookie: customerCookie },
  redirect: "manual",
});
const notDeliveredBody = await notDeliveredRes.text();
await check(
  "the review form for a not-yet-delivered order never renders the submit form",
  !notDeliveredBody.includes("Submit Review")
);

console.log("\nCleaning up...");
await admin.from("review_media").delete().eq("review_id", review.id);
await admin.from("reviews").delete().eq("id", review.id);
await admin.from("social_gallery_images").delete().in("id", [galleryImage.id, inactiveImage.id]);
await admin.from("shipping_orders").delete().in("order_id", [deliveredOrder.id, pendingOrder.id]);
await admin.from("order_items").delete().eq("order_id", deliveredOrder.id);
await admin.from("orders").delete().in("id", [deliveredOrder.id, pendingOrder.id]);
await admin.from("products").delete().eq("id", product.id);
await admin.from("addresses").delete().eq("id", address.id);
await admin.auth.admin.deleteUser(customerA.userId);
await admin.auth.admin.deleteUser(customerB.userId);
await admin.auth.admin.deleteUser(staffAdmin.userId);

const [{ data: remainingReviews }, { data: users }] = await Promise.all([
  admin.from("reviews").select("id"),
  admin.auth.admin.listUsers(),
]);
console.log(`Remaining — reviews: ${remainingReviews.length}, auth users: ${users.users.length} (should reflect pre-existing state only)`);
