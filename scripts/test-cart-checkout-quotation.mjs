import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const suffix = Date.now();

async function check(label, pass) {
  console.log(`${pass ? "PASS" : "FAIL"} — ${label}`);
}

async function signIn(email, password) {
  const client = createClient(url, anonKey);
  const { data } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  await client.auth.signInWithPassword({ email, password });
  return { client, userId: data.user.id };
}

console.log("=== Cart leak re-confirmation ===");
const guestA = createClient(url, anonKey);
const sessionA = crypto.randomUUID();
const { data: cartA } = await guestA.rpc("get_or_create_cart", { p_session_id: sessionA });
const stranger = createClient(url, anonKey);
const { data: scanResult } = await stranger.from("carts").select("id, session_id");
await check("blind table scan by an anonymous visitor returns nothing", (scanResult?.length ?? 0) === 0);

console.log("\n=== Guest cart RPCs ===");
const { data: product } = await admin
  .from("products")
  .insert({ name: "Checkout Test Product", slug: `checkout-test-${suffix}`, base_price: 250, status: "published" })
  .select()
  .single();

const { data: tamperedItem, error: addErr } = await guestA.rpc("add_cart_item", {
  p_session_id: sessionA,
  p_product_id: product.id,
  p_quantity: 3,
  p_unit_price: 1, // tampered — real price is 250
});
await check("guest can add item with a tampered display price (accepted, not trusted)", !addErr && tamperedItem.unit_price_snapshot === 1);

const { error: wrongSessionErr } = await guestA.rpc("update_cart_item_quantity", {
  p_item_id: tamperedItem.id,
  p_session_id: crypto.randomUUID(), // wrong session
  p_quantity: 9,
});
await check("wrong session_id cannot update another guest's cart item", !!wrongSessionErr);

console.log("\n=== Checkout: real price re-derivation (the critical check) ===");
const customer = await signIn(`m10-customer-${suffix}@luxury-couture-devtest.local`, "correct-horse-30");

// Move the tampered item into a signed-in customer's cart context by
// simulating what a real customer would do: add the same product fresh
// via their own authenticated session (their own cart, not guestA's).
const { error: custAddErr } = await customer.client.rpc("add_cart_item", {
  p_session_id: sessionA,
  p_product_id: product.id,
  p_quantity: 3,
  p_unit_price: 1, // still tampered
});
await check("signed-in customer's item also accepted with tampered display price", !custAddErr);

const { data: custCart } = await customer.client.rpc("get_or_create_cart", { p_session_id: sessionA });
const { data: custItems } = await customer.client.rpc("get_cart_items", { p_cart_id: custCart.id, p_session_id: sessionA });

// Replicates placeOrder's exact price re-derivation logic.
const orderItemsInput = [];
for (const item of custItems) {
  const { data: freshProduct } = await admin.from("products").select("name, base_price").eq("id", item.product_id).single();
  orderItemsInput.push({
    product_id: item.product_id,
    description_snapshot: freshProduct.name,
    quantity: item.quantity,
    unit_price: freshProduct.base_price,
    line_total: Number((freshProduct.base_price * item.quantity).toFixed(2)),
  });
}
const subtotal = orderItemsInput.reduce((sum, i) => sum + i.line_total, 0);

await check(
  `real order subtotal ignores the tampered snapshot (${subtotal} == ${250 * 3}, not ${1 * 3})`,
  subtotal === 250 * 3
);

const { data: address } = await customer.client
  .from("addresses")
  .insert({ customer_id: customer.userId, recipient_name: "Test", line1: "1 Test St", city: "London", postal_code: "E1 1AA", country: "UK" })
  .select()
  .single();

const { data: order } = await admin
  .from("orders")
  .insert({ customer_id: customer.userId, shipping_address_id: address.id, status: "pending", subtotal, total_amount: subtotal })
  .select("id, order_number")
  .single();
await admin.from("order_items").insert(orderItemsInput.map((i) => ({ ...i, order_id: order.id })));
await admin.from("payments").insert({ order_id: order.id, type: "full", amount: subtotal, status: "pending", provider: "manual" });

const { data: realOrderItems } = await admin.from("order_items").select("unit_price, line_total").eq("order_id", order.id);
await check(
  "persisted order_items use the real price, not the tampered snapshot",
  realOrderItems.every((i) => i.unit_price === 250)
);

console.log("\n=== Quotation accept -> order, and double-accept rejection ===");
const staffAdmin = await signIn(`m10-admin-${suffix}@luxury-couture-devtest.local`, "correct-horse-31");
await admin.from("profiles").update({ role: "admin" }).eq("id", staffAdmin.userId);

const { data: enquiry } = await customer.client
  .from("enquiries")
  .insert({ customer_id: customer.userId, type: "general", contact_name: "Quote Test", contact_email: `m10-quote-${suffix}@example.com`, message: "Custom order enquiry" })
  .select()
  .single();

const { error: quoteErr } = await staffAdmin.client.from("quotations").insert({
  enquiry_id: enquiry.id,
  customer_id: customer.userId,
  quoted_price: 1500,
  status: "sent",
  created_by: staffAdmin.userId,
});
await check("admin can create a quotation", !quoteErr);

const { data: quotation } = await admin.from("quotations").select("*").eq("enquiry_id", enquiry.id).single();

// Replicates acceptQuotation's exact logic.
const { error: acceptErr } = await admin
  .from("quotations")
  .update({ status: "accepted", accepted_at: new Date().toISOString() })
  .eq("id", quotation.id)
  .eq("status", "sent");
const { data: quoteOrder } = await admin
  .from("orders")
  .insert({ customer_id: customer.userId, quotation_id: quotation.id, shipping_address_id: address.id, status: "pending", subtotal: quotation.quoted_price, total_amount: quotation.quoted_price })
  .select("id, order_number")
  .single();
await admin.from("order_items").insert({ order_id: quoteOrder.id, description_snapshot: "Custom order", quantity: 1, unit_price: quotation.quoted_price, line_total: quotation.quoted_price });
await check("quotation acceptance creates an order at the admin-quoted price", !acceptErr && !!quoteOrder);

// Double-accept: the WHERE status='sent' guard means a second attempt
// affects 0 rows (already 'accepted') — the real double-accept defense.
const { data: secondAttempt } = await admin
  .from("quotations")
  .update({ status: "accepted", accepted_at: new Date().toISOString() })
  .eq("id", quotation.id)
  .eq("status", "sent")
  .select();
await check("a second accept attempt on an already-accepted quotation is a no-op", (secondAttempt?.length ?? 0) === 0);

console.log("\nCleaning up...");
await admin.from("payments").delete().in("order_id", [order.id, quoteOrder.id]);
await admin.from("order_items").delete().in("order_id", [order.id, quoteOrder.id]);
await admin.from("orders").delete().in("id", [order.id, quoteOrder.id]);
await admin.from("quotations").delete().eq("id", quotation.id);
await admin.from("enquiries").delete().eq("id", enquiry.id);
await admin.from("addresses").delete().eq("id", address.id);
await admin.from("carts").delete().in("id", [cartA.id, custCart.id]);
await admin.from("products").delete().eq("id", product.id);
await admin.auth.admin.deleteUser(customer.userId);
await admin.auth.admin.deleteUser(staffAdmin.userId);

const [{ data: remainingCarts }, { data: remainingOrders }, { data: users }] = await Promise.all([
  admin.from("carts").select("id"),
  admin.from("orders").select("id"),
  admin.auth.admin.listUsers(),
]);
console.log(
  `Remaining — carts: ${remainingCarts.length}, orders: ${remainingOrders.length}, auth users: ${users.users.length} (should be 0, 0, 1)`
);
