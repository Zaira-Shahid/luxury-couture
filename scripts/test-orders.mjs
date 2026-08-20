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

console.log("=== Setup: two customers, an admin, one order for customer A ===");
const customerA = await signIn(`m12-a-${suffix}@luxury-couture-devtest.local`, "correct-horse-50");
const customerB = await signIn(`m12-b-${suffix}@luxury-couture-devtest.local`, "correct-horse-51");
const staffAdmin = await signIn(`m12-admin-${suffix}@luxury-couture-devtest.local`, "correct-horse-52");
await admin.from("profiles").update({ role: "admin" }).eq("id", staffAdmin.userId);

const { data: address } = await admin
  .from("addresses")
  .insert({ customer_id: customerA.userId, recipient_name: "A", line1: "1 Test St", city: "London", postal_code: "E1 1AA", country: "UK" })
  .select()
  .single();

const { data: order } = await admin
  .from("orders")
  .insert({ customer_id: customerA.userId, shipping_address_id: address.id, status: "pending", subtotal: 400, total_amount: 400, balance_due_amount: 400 })
  .select("id, order_number")
  .single();
await admin.from("order_items").insert({ order_id: order.id, description_snapshot: "Test Lehenga", quantity: 1, unit_price: 400, line_total: 400 });

console.log("\n=== RLS: cross-customer order visibility ===");
const { data: bScanOrder } = await customerB.client.from("orders").select("id").eq("id", order.id);
await check("customer B cannot see customer A's order", (bScanOrder?.length ?? 0) === 0);
const { data: aSeesOwnOrder } = await customerA.client.from("orders").select("id").eq("id", order.id);
await check("customer A can see their own order", (aSeesOwnOrder?.length ?? 0) === 1);

console.log("\n=== Admin: status change (mimics updateOrderStatus) ===");
const { error: statusErr } = await staffAdmin.client.from("orders").update({ status: "confirmed" }).eq("id", order.id);
await check("admin can update order status", !statusErr);
await staffAdmin.client.from("order_status_history").insert({ order_id: order.id, status: "confirmed", note: "Payment confirmed manually.", changed_by: staffAdmin.userId });
await staffAdmin.client.from("notifications").insert({ profile_id: customerA.userId, type: "order_status_changed", title: "Your order status has been updated", body: "Order status is now: confirmed.", channel: "in_app" });

const { data: historyForA } = await customerA.client.from("order_status_history").select("*").eq("order_id", order.id);
await check("status change created a history row visible to the owner", (historyForA?.length ?? 0) === 1 && historyForA[0].status === "confirmed");

const { data: notificationForA } = await customerA.client.from("notifications").select("*").eq("profile_id", customerA.userId).eq("type", "order_status_changed");
await check("status change created a notification visible to the owner", (notificationForA?.length ?? 0) === 1);

console.log("\n=== RLS: cross-customer status history / notification visibility ===");
const { data: bScanHistory } = await customerB.client.from("order_status_history").select("id").eq("order_id", order.id);
await check("customer B cannot see customer A's order status history", (bScanHistory?.length ?? 0) === 0);
const { data: bScanNotification } = await customerB.client.from("notifications").select("id").eq("profile_id", customerA.userId);
await check("customer B cannot see customer A's notifications", (bScanNotification?.length ?? 0) === 0);

console.log("\n=== order_notes: admin-only, never customer-reachable under any query ===");
const { error: customerNoteInsertErr } = await customerA.client.from("order_notes").insert({ order_id: order.id, note: "customer trying to write a note" });
await check("customer cannot insert into order_notes (blocked by RLS)", !!customerNoteInsertErr);

const { error: adminNoteErr } = await staffAdmin.client.from("order_notes").insert({ order_id: order.id, note: "Customer called about delivery timeline.", created_by: staffAdmin.userId });
await check("admin can insert an internal order note", !adminNoteErr);

const { data: customerReadsOwnOrderNotes } = await customerA.client.from("order_notes").select("id").eq("order_id", order.id);
await check("the order's OWNER still cannot read order_notes (admin-only table, not owner-or-admin)", (customerReadsOwnOrderNotes?.length ?? 0) === 0);

const { data: customerBlindScanNotes } = await customerA.client.from("order_notes").select("id");
await check("an unfiltered order_notes scan by the owner also returns nothing", (customerBlindScanNotes?.length ?? 0) === 0);

const { data: adminReadsNotes } = await staffAdmin.client.from("order_notes").select("id").eq("order_id", order.id);
await check("admin can read the note back", (adminReadsNotes?.length ?? 0) === 1);

console.log("\n=== Send to production (mimics sendToProduction): idempotency ===");
const { data: existingBefore } = await staffAdmin.client.from("production_orders").select("id").eq("order_id", order.id).maybeSingle();
await check("no production_orders row exists yet", !existingBefore);

const { error: firstSendErr } = await staffAdmin.client.from("production_orders").insert({ order_id: order.id, estimated_completion_date: "2026-09-15" });
await check("first send-to-production succeeds", !firstSendErr);

const { data: existingAfter } = await staffAdmin.client.from("production_orders").select("id").eq("order_id", order.id).maybeSingle();
await check("a production_orders row now exists (checked before a second attempt, as the real action does)", !!existingAfter);
// The real action checks existence first and returns an error rather than
// attempting a second insert — but the table's own unique constraint on
// order_id is the actual backstop, so confirm that too.
const { error: secondSendErr } = await staffAdmin.client.from("production_orders").insert({ order_id: order.id });
await check("a second insert is rejected by the unique constraint (structural backstop)", !!secondSendErr);

console.log("\n=== Notification mark-as-read: owner-scoped ===");
const notificationId = notificationForA[0].id;
const { error: bMarkReadErr, data: bMarkReadData } = await customerB.client
  .from("notifications")
  .update({ read_at: new Date().toISOString() })
  .eq("id", notificationId)
  .eq("profile_id", customerB.userId)
  .select();
await check("customer B's attempt to mark A's notification read affects 0 rows", !bMarkReadErr && (bMarkReadData?.length ?? 0) === 0);

const { data: stillUnread } = await admin.from("notifications").select("read_at").eq("id", notificationId).single();
await check("the notification is still unread after B's no-op attempt", stillUnread.read_at === null);

const { error: aMarkReadErr } = await customerA.client
  .from("notifications")
  .update({ read_at: new Date().toISOString() })
  .eq("id", notificationId)
  .eq("profile_id", customerA.userId);
await check("customer A can mark their own notification read", !aMarkReadErr);
const { data: nowRead } = await admin.from("notifications").select("read_at").eq("id", notificationId).single();
await check("the notification is now marked read", nowRead.read_at !== null);

console.log("\nCleaning up...");
await admin.from("order_notes").delete().eq("order_id", order.id);
await admin.from("order_status_history").delete().eq("order_id", order.id);
await admin.from("production_orders").delete().eq("order_id", order.id);
await admin.from("notifications").delete().in("profile_id", [customerA.userId, customerB.userId]);
await admin.from("order_items").delete().eq("order_id", order.id);
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
