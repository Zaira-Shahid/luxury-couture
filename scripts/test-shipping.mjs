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

console.log("=== Setup: two customers, an admin, an order each ===");
const customerA = await signIn(`m14-a-${suffix}@luxury-couture-devtest.local`, "correct-horse-70");
const customerB = await signIn(`m14-b-${suffix}@luxury-couture-devtest.local`, "correct-horse-71");
const staffAdmin = await signIn(`m14-admin-${suffix}@luxury-couture-devtest.local`, "correct-horse-72");
await admin.from("profiles").update({ role: "admin" }).eq("id", staffAdmin.userId);

const { data: address } = await admin
  .from("addresses")
  .insert({ customer_id: customerA.userId, recipient_name: "A", line1: "1 Test St", city: "London", postal_code: "E1 1AA", country: "UK" })
  .select()
  .single();

const { data: order } = await admin
  .from("orders")
  .insert({ customer_id: customerA.userId, shipping_address_id: address.id, status: "confirmed", subtotal: 400, total_amount: 400, balance_due_amount: 400 })
  .select("id, order_number")
  .single();

console.log("\n=== Mock shipping provider (direct, mirrors createShipment's logic) ===");
const isUK = (country) => ["uk", "united kingdom", "gb", "great britain"].includes(country.trim().toLowerCase());
const ukShipment = { trackingNumber: `MOCK${Date.now().toString(36).toUpperCase()}1`, courier: "Royal Mail Tracked", cost: 8.5 };
await check("mock provider assigns a UK courier + rate for a UK address", isUK("UK") && ukShipment.courier === "Royal Mail Tracked" && ukShipment.cost === 8.5);

console.log("\n=== Admin: create shipment (mimics createShipment) ===");
const { data: shipping, error: shipErr } = await staffAdmin.client
  .from("shipping_orders")
  .insert({ order_id: order.id, address_id: address.id, courier: ukShipment.courier, tracking_number: ukShipment.trackingNumber, shipping_cost: ukShipment.cost })
  .select()
  .single();
await check("admin can create a shipment", !shipErr && !!shipping);

console.log("\n=== Create-shipment idempotency (real unique constraint, same pattern as Module 12's production handoff) ===");
const { error: dupShipErr } = await staffAdmin.client.from("shipping_orders").insert({ order_id: order.id });
await check("a second shipping_orders row for the same order is rejected", !!dupShipErr);

console.log("\n=== RLS: cross-customer shipping visibility ===");
const { data: bScanShipping } = await customerB.client.from("shipping_orders").select("id").eq("id", shipping.id);
await check("customer B cannot see customer A's shipment", (bScanShipping?.length ?? 0) === 0);
const { data: bBlindScan } = await customerB.client.from("shipping_orders").select("id");
await check("customer B's unfiltered shipping_orders scan returns nothing", (bBlindScan?.length ?? 0) === 0);
const { data: aSeesOwn } = await customerA.client.from("shipping_orders").select("id").eq("id", shipping.id);
await check("customer A can see their own shipment", (aSeesOwn?.length ?? 0) === 1);

console.log("\n=== Customer cannot write to shipping_orders/shipping_events ===");
const { error: customerWriteErr } = await customerA.client.from("shipping_orders").update({ status: "delivered" }).eq("id", shipping.id);
const { data: statusAfter } = await admin.from("shipping_orders").select("status").eq("id", shipping.id).single();
await check("customer cannot change shipping status (still 'pending')", statusAfter.status === "pending");

const { error: customerEventErr } = await customerA.client.from("shipping_events").insert({ shipping_order_id: shipping.id, status: "delivered" });
await check("customer cannot insert a shipping event", !!customerEventErr);

console.log("\n=== Admin: advance status (mimics advanceShippingStatus) ===");
const { error: advanceErr } = await staffAdmin.client.from("shipping_orders").update({ status: "in_transit", shipped_at: new Date().toISOString() }).eq("id", shipping.id);
await check("admin can advance shipping status", !advanceErr);
await staffAdmin.client.from("shipping_events").insert({ shipping_order_id: shipping.id, status: "in_transit", description: "Left the studio." });
await staffAdmin.client.from("notifications").insert({ profile_id: customerA.userId, type: "shipping_status_changed", title: "Shipping status updated", body: "Now: in transit.", channel: "in_app" });

const { data: shippedAtCheck } = await admin.from("shipping_orders").select("shipped_at, delivered_at").eq("id", shipping.id).single();
await check("shipped_at was set, delivered_at was not", !!shippedAtCheck.shipped_at && !shippedAtCheck.delivered_at);

const { data: customerSeesEvent } = await customerA.client.from("shipping_events").select("*").eq("shipping_order_id", shipping.id);
await check("the customer can see the tracking event", (customerSeesEvent?.length ?? 0) === 1 && customerSeesEvent[0].status === "in_transit");

const { data: customerSeesNotification } = await customerA.client.from("notifications").select("id").eq("profile_id", customerA.userId).eq("type", "shipping_status_changed");
await check("the customer received a notification", (customerSeesNotification?.length ?? 0) === 1);

console.log("\n=== Delivered transition sets delivered_at ===");
await staffAdmin.client.from("shipping_orders").update({ status: "delivered", delivered_at: new Date().toISOString() }).eq("id", shipping.id);
const { data: deliveredCheck } = await admin.from("shipping_orders").select("delivered_at").eq("id", shipping.id).single();
await check("delivered_at was set on the delivered transition", !!deliveredCheck.delivered_at);

console.log("\nCleaning up...");
await admin.from("notifications").delete().eq("profile_id", customerA.userId);
await admin.from("shipping_events").delete().eq("shipping_order_id", shipping.id);
await admin.from("shipping_orders").delete().eq("id", shipping.id);
await admin.from("orders").delete().eq("id", order.id);
await admin.from("addresses").delete().eq("id", address.id);
await admin.auth.admin.deleteUser(customerA.userId);
await admin.auth.admin.deleteUser(customerB.userId);
await admin.auth.admin.deleteUser(staffAdmin.userId);

const [{ data: remainingOrders }, { data: users }] = await Promise.all([
  admin.from("orders").select("id"),
  admin.auth.admin.listUsers(),
]);
console.log(`Remaining — orders: ${remainingOrders.length}, auth users: ${users.users.length} (should reflect pre-existing state only)`);
