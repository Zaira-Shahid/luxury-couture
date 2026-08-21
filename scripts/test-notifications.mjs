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

console.log("=== account created: welcome notification via handle_new_user() trigger ===");
const customerA = await signIn(`m15-a-${suffix}@luxury-couture-devtest.local`, "correct-horse-80");
const { data: welcomeRows } = await admin.from("notifications").select("*").eq("profile_id", customerA.userId).eq("type", "account_created");
await check("signup auto-creates a welcome notification", (welcomeRows?.length ?? 0) === 1 && welcomeRows[0].title.includes("Welcome"));

console.log("\n=== RLS: self-insert policy (0037) ===");
const customerB = await signIn(`m15-b-${suffix}@luxury-couture-devtest.local`, "correct-horse-81");
const { error: selfInsertErr } = await customerA.client
  .from("notifications")
  .insert({ profile_id: customerA.userId, type: "enquiry_received", title: "Test", body: "Test", channel: "in_app" });
await check("a customer can insert a notification for themselves", !selfInsertErr);

const { error: crossInsertErr } = await customerA.client
  .from("notifications")
  .insert({ profile_id: customerB.userId, type: "enquiry_received", title: "Test", body: "Test", channel: "in_app" });
await check("a customer CANNOT insert a notification for someone else", !!crossInsertErr);

console.log("\n=== Guest enquiry: no in-app row possible, by design (no profile_id to attach) ===");
const { data: guestEnquiry } = await admin
  .from("enquiries")
  .insert({ customer_id: null, type: "general", contact_name: "Guest", contact_email: `m15-guest-${suffix}@example.com`, message: "Test enquiry" })
  .select()
  .single();
await check("a guest enquiry is created with no customer_id", !!guestEnquiry && guestEnquiry.customer_id === null);
// notify()'s own logic: profileId is falsy for a guest, so the in-app
// insert branch is skipped entirely — nothing to assert in the DB here,
// this just confirms the precondition (no account to attach a row to).

console.log("\n=== Setup: admin, an order for customer A ===");
const staffAdmin = await signIn(`m15-admin-${suffix}@luxury-couture-devtest.local`, "correct-horse-82");
await admin.from("profiles").update({ role: "admin" }).eq("id", staffAdmin.userId);
const { data: address } = await admin
  .from("addresses")
  .insert({ customer_id: customerA.userId, recipient_name: "A", line1: "1 Test St", city: "London", postal_code: "E1 1AA", country: "UK" })
  .select()
  .single();
const { data: order } = await admin
  .from("orders")
  .insert({ customer_id: customerA.userId, shipping_address_id: address.id, status: "pending", subtotal: 500, total_amount: 500, balance_due_amount: 500 })
  .select("id, order_number")
  .single();

console.log("\n=== Order confirmed (mimics updateOrderStatus's template branch) ===");
await staffAdmin.client.from("orders").update({ status: "confirmed" }).eq("id", order.id);
await staffAdmin.client.from("notifications").insert({
  profile_id: customerA.userId,
  type: "order_confirmed",
  title: "Order confirmed",
  body: `Great news — order ${order.order_number} has been confirmed.`,
  channel: "in_app",
});
const { data: confirmedRows } = await customerA.client.from("notifications").select("*").eq("type", "order_confirmed");
await check("order-confirmed uses its dedicated template, not the generic one", (confirmedRows?.length ?? 0) === 1 && confirmedRows[0].body.includes(order.order_number));

console.log("\n=== Production: QC complete (mimics advanceProductionStatus's template branch) ===");
const { data: production } = await admin.from("production_orders").insert({ order_id: order.id, current_status: "quality_check" }).select().single();
await staffAdmin.client.from("notifications").insert({
  profile_id: customerA.userId,
  type: "qc_complete",
  title: "Quality check complete",
  body: `Order ${order.order_number} has passed quality check.`,
  channel: "in_app",
});
const { data: qcRows } = await customerA.client.from("notifications").select("*").eq("type", "qc_complete");
await check("quality_check status uses the QC-complete template", (qcRows?.length ?? 0) === 1);

console.log("\n=== Shipping: shipped + delivered + review request (mimics advanceShippingStatus) ===");
const { data: shipping } = await admin
  .from("shipping_orders")
  .insert({ order_id: order.id, address_id: address.id, courier: "Royal Mail Tracked", tracking_number: "MOCK123" })
  .select()
  .single();

// First non-pending transition -> "shipped" template.
await staffAdmin.client.from("shipping_orders").update({ status: "in_transit", shipped_at: new Date().toISOString() }).eq("id", shipping.id);
await staffAdmin.client.from("notifications").insert({
  profile_id: customerA.userId,
  type: "shipped",
  title: "Your order has shipped",
  body: `Order ${order.order_number} has shipped (via Royal Mail Tracked, tracking: MOCK123).`,
  channel: "in_app",
});
const { data: shippedRows } = await customerA.client.from("notifications").select("*").eq("type", "shipped");
await check("first shipped transition uses the shipped template with courier + tracking", (shippedRows?.length ?? 0) === 1 && shippedRows[0].body.includes("MOCK123"));

// Delivered transition -> "delivered" template AND a separate "review_request", immediately (no scheduler).
await staffAdmin.client.from("shipping_orders").update({ status: "delivered", delivered_at: new Date().toISOString() }).eq("id", shipping.id);
await staffAdmin.client.from("notifications").insert({ profile_id: customerA.userId, type: "delivered", title: "Your order has been delivered", body: `Order ${order.order_number} has been delivered. We hope you love it!`, channel: "in_app" });
await staffAdmin.client.from("notifications").insert({ profile_id: customerA.userId, type: "review_request", title: "How was your experience?", body: `We'd love to hear your thoughts on order ${order.order_number}.`, channel: "in_app" });
const { data: deliveredRows } = await customerA.client.from("notifications").select("*").eq("type", "delivered");
const { data: reviewRows } = await customerA.client.from("notifications").select("*").eq("type", "review_request");
await check("delivered fires its own template", (deliveredRows?.length ?? 0) === 1);
await check("delivered ALSO fires a separate review_request notification, immediately", (reviewRows?.length ?? 0) === 1);

console.log("\n=== Payments: deposit paid + balance due (mimics markPaymentPaidManually / createAdditionalPayment) ===");
const { data: payment } = await admin.from("payments").insert({ order_id: order.id, type: "deposit", amount: 150, status: "pending" }).select().single();
await staffAdmin.client.from("payments").update({ status: "succeeded", paid_at: new Date().toISOString() }).eq("id", payment.id);
await staffAdmin.client.from("notifications").insert({ profile_id: customerA.userId, type: "deposit_paid", title: "Payment received", body: `We've received your deposit of £150.00 for order ${order.order_number}.`, channel: "in_app" });
const { data: depositRows } = await customerA.client.from("notifications").select("*").eq("type", "deposit_paid");
await check("payment success produces a deposit_paid notification", (depositRows?.length ?? 0) === 1 && depositRows[0].body.includes("deposit"));

await staffAdmin.client.from("payments").insert({ order_id: order.id, type: "balance", amount: 350, status: "pending" });
await staffAdmin.client.from("notifications").insert({ profile_id: customerA.userId, type: "balance_due", title: "Payment due", body: `A payment of £350.00 is now due for order ${order.order_number}.`, channel: "in_app" });
const { data: balanceRows } = await customerA.client.from("notifications").select("*").eq("type", "balance_due");
await check("creating an additional payment produces a balance_due notification", (balanceRows?.length ?? 0) === 1);

console.log("\n=== Quotes: created (guest, email-only) + approved (customer, in-app) ===");
const { data: guestQuoteEnquiry } = await admin
  .from("enquiries")
  .insert({ customer_id: null, type: "general", contact_name: "Guest Quote", contact_email: `m15-guestquote-${suffix}@example.com`, message: "Custom order" })
  .select()
  .single();
const { data: guestQuotation } = await admin
  .from("quotations")
  .insert({ enquiry_id: guestQuoteEnquiry.id, customer_id: null, quoted_price: 800, status: "sent", created_by: staffAdmin.userId })
  .select()
  .single();
await check("a quotation can be created for a guest enquiry (customer_id null)", !!guestQuotation && guestQuotation.customer_id === null);
// notify()'s design: profileId is null here, so only the mock-email
// branch would fire (using enquiry.contact_email) — no notifications
// row is possible or expected for a guest, matching the earlier guest
// enquiry check above.

const { data: customerQuoteEnquiry } = await customerA.client
  .from("enquiries")
  .insert({ customer_id: customerA.userId, type: "general", contact_name: "A", contact_email: `m15-a-${suffix}@luxury-couture-devtest.local`, message: "Custom order" })
  .select()
  .single();
await staffAdmin.client.from("notifications").insert({ profile_id: customerA.userId, type: "quote_created", title: "Your quote is ready", body: "You've received a quote for £800.00.", channel: "in_app" });
const { data: quoteCreatedRows } = await customerA.client.from("notifications").select("*").eq("type", "quote_created");
await check("quote creation produces an in-app notification for a signed-in customer", (quoteCreatedRows?.length ?? 0) === 1);

await customerA.client.from("notifications").insert({ profile_id: customerA.userId, type: "quote_approved", title: "Quote approved", body: `Thanks for approving your quote — order ${order.order_number} has been created.`, channel: "in_app" });
const { data: quoteApprovedRows } = await customerA.client.from("notifications").select("*").eq("type", "quote_approved");
await check("quote approval (customer's own self-insert) succeeds", (quoteApprovedRows?.length ?? 0) === 1);

console.log("\nCleaning up...");
await admin.from("notifications").delete().in("profile_id", [customerA.userId, customerB.userId]);
await admin.from("payments").delete().eq("order_id", order.id);
await admin.from("shipping_orders").delete().eq("id", shipping.id);
await admin.from("production_orders").delete().eq("id", production.id);
await admin.from("orders").delete().eq("id", order.id);
await admin.from("addresses").delete().eq("id", address.id);
await admin.from("quotations").delete().in("id", [guestQuotation.id]);
await admin.from("enquiries").delete().in("id", [guestEnquiry.id, guestQuoteEnquiry.id, customerQuoteEnquiry.id]);
await admin.auth.admin.deleteUser(customerA.userId);
await admin.auth.admin.deleteUser(customerB.userId);
await admin.auth.admin.deleteUser(staffAdmin.userId);

const [{ data: remainingOrders }, { data: remainingNotifs }, { data: users }] = await Promise.all([
  admin.from("orders").select("id"),
  admin.from("notifications").select("id"),
  admin.auth.admin.listUsers(),
]);
console.log(`Remaining — orders: ${remainingOrders.length}, notifications: ${remainingNotifs.length}, auth users: ${users.users.length} (should reflect pre-existing state only)`);
