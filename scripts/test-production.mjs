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

console.log("=== Setup: a customer, an admin, a production-staff account, two orders ===");
const customer = await signIn(`m13-customer-${suffix}@luxury-couture-devtest.local`, "correct-horse-60");
const staffAdmin = await signIn(`m13-admin-${suffix}@luxury-couture-devtest.local`, "correct-horse-61");
const production = await signIn(`m13-production-${suffix}@luxury-couture-devtest.local`, "correct-horse-62");
await admin.from("profiles").update({ role: "admin" }).eq("id", staffAdmin.userId);
await admin.from("profiles").update({ role: "production" }).eq("id", production.userId);

const { data: address } = await admin
  .from("addresses")
  .insert({ customer_id: customer.userId, recipient_name: "C", line1: "1 Test St", city: "London", postal_code: "E1 1AA", country: "UK" })
  .select()
  .single();

// handedOffOrder already has a production_orders row; notYetHandedOffOrder doesn't.
const { data: handedOffOrder } = await admin
  .from("orders")
  .insert({ customer_id: customer.userId, shipping_address_id: address.id, status: "confirmed", subtotal: 500, total_amount: 500, balance_due_amount: 500 })
  .select("id, order_number")
  .single();
await admin.from("order_items").insert({ order_id: handedOffOrder.id, description_snapshot: "Test Lehenga", quantity: 1, unit_price: 500, line_total: 500 });
const { data: productionOrder } = await admin
  .from("production_orders")
  .insert({ order_id: handedOffOrder.id })
  .select()
  .single();

const { data: notYetHandedOffOrder } = await admin
  .from("orders")
  .insert({ customer_id: customer.userId, shipping_address_id: address.id, status: "pending", subtotal: 300, total_amount: 300, balance_due_amount: 300 })
  .select("id, order_number")
  .single();
await admin.from("order_items").insert({ order_id: notYetHandedOffOrder.id, description_snapshot: "Not yet in production", quantity: 1, unit_price: 300, line_total: 300 });

console.log("\n=== Production staff: read scoping ===");
const { data: canReadHandedOff } = await production.client.from("orders").select("id").eq("id", handedOffOrder.id);
await check("production staff can read a handed-off order", (canReadHandedOff?.length ?? 0) === 1);

const { data: canReadItems } = await production.client.from("order_items").select("id").eq("order_id", handedOffOrder.id);
await check("production staff can read that order's items", (canReadItems?.length ?? 0) === 1);

const { data: cannotReadNotHandedOff } = await production.client.from("orders").select("id").eq("id", notYetHandedOffOrder.id);
await check("production staff CANNOT read an order not yet sent to production", (cannotReadNotHandedOff?.length ?? 0) === 0);

const { data: blindOrderScan } = await production.client.from("orders").select("id");
await check("production staff's unfiltered orders scan returns only handed-off orders (1, not 2)", (blindOrderScan?.length ?? 0) === 1);

const { data: canReadProductionOrder } = await production.client.from("production_orders").select("id").eq("id", productionOrder.id);
await check("production staff can read the production_orders row", (canReadProductionOrder?.length ?? 0) === 1);

console.log("\n=== Production staff: advancing status (mimics advanceProductionStatus) ===");
const { error: statusErr } = await production.client.from("production_orders").update({ current_status: "cutting" }).eq("id", productionOrder.id);
await check("production staff can update current_status", !statusErr);

const { error: historyErr } = await production.client.from("production_status_history").insert({ production_order_id: productionOrder.id, status: "cutting", note: "Cutting started.", changed_by: production.userId });
await check("production staff can insert a status history row", !historyErr);

const { error: notifErr } = await production.client.from("notifications").insert({ profile_id: customer.userId, type: "production_status_changed", title: "Production status updated", body: "Now: cutting.", channel: "in_app" });
await check("production staff can insert a customer notification for this event", !notifErr);

const { data: customerSeesHistory } = await customer.client.from("production_status_history").select("*").eq("production_order_id", productionOrder.id);
await check("the customer can see the production status history entry", (customerSeesHistory?.length ?? 0) === 1 && customerSeesHistory[0].status === "cutting");

console.log("\n=== Production staff: genuinely limited access elsewhere ===");
const { data: cannotSeePayments } = await production.client.from("payments").select("id");
await check("production staff cannot read any payments (blind scan returns nothing)", (cannotSeePayments?.length ?? 0) === 0);

const { error: cannotWriteOrderStatusErr } = await production.client.from("orders").update({ status: "cancelled" }).eq("id", handedOffOrder.id).select();
const { data: orderStatusAfter } = await admin.from("orders").select("status").eq("id", handedOffOrder.id).single();
await check("production staff cannot change orders.status (still 'confirmed')", orderStatusAfter.status === "confirmed");

const { error: cannotWriteOrderNoteErr } = await production.client.from("order_notes").insert({ order_id: handedOffOrder.id, note: "production staff trying to write an admin note" });
await check("production staff cannot write order_notes", !!cannotWriteOrderNoteErr);

console.log("\n=== A plain admin account still has full access ===");
const { data: adminReadsBoth } = await staffAdmin.client.from("orders").select("id").in("id", [handedOffOrder.id, notYetHandedOffOrder.id]);
await check("admin can read both orders (handed off and not)", (adminReadsBoth?.length ?? 0) === 2);

const { error: adminStatusErr } = await staffAdmin.client.from("production_orders").update({ current_status: "embroidery" }).eq("id", productionOrder.id);
await check("admin can also advance production status directly", !adminStatusErr);

console.log("\n=== Send-to-production idempotency still holds (Module 12's own check, re-confirmed here) ===");
const { error: dupProductionErr } = await staffAdmin.client.from("production_orders").insert({ order_id: handedOffOrder.id });
await check("a second production_orders row for the same order is rejected", !!dupProductionErr);

console.log("\nCleaning up...");
await admin.from("notifications").delete().eq("profile_id", customer.userId);
await admin.from("production_status_history").delete().eq("production_order_id", productionOrder.id);
await admin.from("production_orders").delete().eq("id", productionOrder.id);
await admin.from("order_items").delete().in("order_id", [handedOffOrder.id, notYetHandedOffOrder.id]);
await admin.from("orders").delete().in("id", [handedOffOrder.id, notYetHandedOffOrder.id]);
await admin.from("addresses").delete().eq("id", address.id);
await admin.auth.admin.deleteUser(customer.userId);
await admin.auth.admin.deleteUser(staffAdmin.userId);
await admin.auth.admin.deleteUser(production.userId);

const [{ data: remainingOrders }, { data: users }] = await Promise.all([
  admin.from("orders").select("id"),
  admin.auth.admin.listUsers(),
]);
console.log(`Remaining — orders: ${remainingOrders.length}, auth users: ${users.users.length} (should reflect pre-existing state only)`);
