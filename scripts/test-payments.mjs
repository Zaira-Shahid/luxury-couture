import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import crypto from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const appUrl = process.env.APP_URL ?? "http://localhost:3000";
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

function signStripePayload(payload, secret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${payload}`;
  const signature = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

console.log("=== Setup: two customers, one order each ===");
const customerA = await signIn(`m11-a-${suffix}@luxury-couture-devtest.local`, "correct-horse-40");
const customerB = await signIn(`m11-b-${suffix}@luxury-couture-devtest.local`, "correct-horse-41");

const { data: addressA } = await admin
  .from("addresses")
  .insert({ customer_id: customerA.userId, recipient_name: "A", line1: "1 Test St", city: "London", postal_code: "E1 1AA", country: "UK" })
  .select()
  .single();

const { data: orderA } = await admin
  .from("orders")
  .insert({ customer_id: customerA.userId, shipping_address_id: addressA.id, status: "pending", subtotal: 300, total_amount: 300, balance_due_amount: 300 })
  .select("id, order_number")
  .single();

const { data: paymentA } = await admin
  .from("payments")
  .insert({ order_id: orderA.id, type: "full", amount: 300, status: "pending", provider: "manual" })
  .select()
  .single();

console.log("\n=== RLS: cross-customer payment visibility ===");
const { data: bScanA } = await customerB.client.from("payments").select("id").eq("id", paymentA.id);
await check("customer B cannot see customer A's payment", (bScanA?.length ?? 0) === 0);

const { data: aSeesOwn } = await customerA.client.from("payments").select("id").eq("id", paymentA.id);
await check("customer A can see their own payment", (aSeesOwn?.length ?? 0) === 1);

const { data: bBlindScan } = await customerB.client.from("payments").select("id");
await check("customer B's unfiltered payments scan returns nothing (not just filtered)", (bBlindScan?.length ?? 0) === 0);

console.log("\n=== Manual payment flow (mimics markPaymentPaidManually) ===");
const { error: manualPaidErr } = await admin
  .from("payments")
  .update({ status: "succeeded", paid_at: new Date().toISOString(), provider: "manual" })
  .eq("id", paymentA.id);
await check("admin marks manual payment paid", !manualPaidErr);

const { data: afterManual } = await customerA.client.from("payments").select("status, paid_at").eq("id", paymentA.id).single();
await check("owner sees succeeded status via getMyPayments-equivalent query", afterManual?.status === "succeeded" && !!afterManual?.paid_at);

console.log("\n=== Manual refund (mimics refundPayment for provider=manual) ===");
const { error: manualRefundErr } = await admin.from("payments").update({ status: "refunded" }).eq("id", paymentA.id);
await check("manual payment refund updates status directly (no provider call)", !manualRefundErr);
const { data: afterManualRefund } = await admin.from("payments").select("status").eq("id", paymentA.id).single();
await check("manual payment status is now refunded", afterManualRefund?.status === "refunded");

console.log("\n=== Stripe: real Checkout Session creation against the live test-mode API ===");
const { data: orderB } = await admin
  .from("orders")
  .insert({ customer_id: customerB.userId, shipping_address_id: addressA.id, status: "pending", subtotal: 500, total_amount: 500, balance_due_amount: 500 })
  .select("id, order_number")
  .single();
const { data: paymentB } = await admin
  .from("payments")
  .insert({ order_id: orderB.id, type: "full", amount: 500, status: "pending", provider: "stripe" })
  .select()
  .single();

const session = await stripe.checkout.sessions.create({
  mode: "payment",
  line_items: [{ price_data: { currency: "gbp", product_data: { name: `Payment — Order ${orderB.order_number}` }, unit_amount: 50000 }, quantity: 1 }],
  success_url: `${appUrl}/checkout/confirmed/${orderB.order_number}?payment=success`,
  cancel_url: `${appUrl}/checkout/confirmed/${orderB.order_number}?payment=cancelled`,
  metadata: { paymentId: paymentB.id },
});
await check("Stripe returns a real checkout session with a hosted url", !!session.url && session.id.startsWith("cs_"));
await admin.from("payments").update({ provider_reference: session.id }).eq("id", paymentB.id);

console.log("\n=== Webhook: checkout.session.completed (self-signed, sent to the live route) ===");
const fakeEvent = {
  id: `evt_test_${suffix}`,
  object: "event",
  type: "checkout.session.completed",
  data: { object: { id: session.id, object: "checkout.session", metadata: { paymentId: paymentB.id }, payment_intent: `pi_fake_${suffix}` } },
};
const payload = JSON.stringify(fakeEvent);
const sigHeader = signStripePayload(payload, webhookSecret);

const webhookRes = await fetch(`${appUrl}/api/webhooks/stripe`, {
  method: "POST",
  headers: { "content-type": "application/json", "stripe-signature": sigHeader },
  body: payload,
});
await check("webhook route accepts a validly signed event (200)", webhookRes.status === 200);

const { data: afterWebhook } = await admin.from("payments").select("status, paid_at, provider_reference").eq("id", paymentB.id).single();
await check("payment marked succeeded by the webhook", afterWebhook?.status === "succeeded" && !!afterWebhook?.paid_at);

const { data: orderBAfter } = await admin.from("orders").select("status, balance_due_amount").eq("id", orderB.id).single();
await check("order status bumped pending -> confirmed", orderBAfter?.status === "confirmed");
await check("order balance_due_amount recomputed to 0", Number(orderBAfter?.balance_due_amount) === 0);

const { data: txRows } = await admin.from("payment_transactions").select("id").eq("payment_id", paymentB.id);
await check("event logged to payment_transactions", (txRows?.length ?? 0) === 1);

console.log("\n=== Webhook: bad signature is rejected ===");
const badSigRes = await fetch(`${appUrl}/api/webhooks/stripe`, {
  method: "POST",
  headers: { "content-type": "application/json", "stripe-signature": "t=1,v1=deadbeef" },
  body: payload,
});
await check("webhook route rejects an invalid signature (400)", badSigRes.status === 400);

console.log("\n=== Webhook: duplicate delivery is idempotent ===");
const dupRes = await fetch(`${appUrl}/api/webhooks/stripe`, {
  method: "POST",
  headers: { "content-type": "application/json", "stripe-signature": signStripePayload(payload, webhookSecret) },
  body: payload,
});
await check("duplicate webhook delivery still returns 200", dupRes.status === 200);
const { data: orderBAfterDup } = await admin.from("orders").select("balance_due_amount").eq("id", orderB.id).single();
await check("balance_due_amount unchanged by duplicate delivery (idempotent)", Number(orderBAfterDup?.balance_due_amount) === 0);
const { data: txRowsAfterDup } = await admin.from("payment_transactions").select("id").eq("payment_id", paymentB.id);
await check("duplicate delivery logs a second transaction row (audit trail, not deduped)", (txRowsAfterDup?.length ?? 0) === 2);

console.log("\n=== Webhook: charge.refunded ===");
const refundEvent = {
  id: `evt_test_refund_${suffix}`,
  object: "event",
  type: "charge.refunded",
  data: { object: { id: `ch_fake_${suffix}`, object: "charge", payment_intent: `pi_fake_${suffix}` } },
};
// Bridging our fake payment_intent to a real session isn't possible for a
// synthetic id, so this exercises the handler's code path (list-by-
// payment_intent, then no-op when nothing matches) rather than a full DB
// status flip — a real refund's payment_intent always resolves because it
// comes from a real completed Checkout Session.
const refundPayload = JSON.stringify(refundEvent);
const refundRes = await fetch(`${appUrl}/api/webhooks/stripe`, {
  method: "POST",
  headers: { "content-type": "application/json", "stripe-signature": signStripePayload(refundPayload, webhookSecret) },
  body: refundPayload,
});
await check("charge.refunded event is accepted (200) and handled without error", refundRes.status === 200);

console.log("\nCleaning up...");
await admin.from("payment_transactions").delete().eq("payment_id", paymentB.id);
await admin.from("payments").delete().in("order_id", [orderA.id, orderB.id]);
await admin.from("orders").delete().in("id", [orderA.id, orderB.id]);
await admin.from("addresses").delete().eq("id", addressA.id);
await admin.auth.admin.deleteUser(customerA.userId);
await admin.auth.admin.deleteUser(customerB.userId);

const [{ data: remainingOrders }, { data: users }] = await Promise.all([
  admin.from("orders").select("id"),
  admin.auth.admin.listUsers(),
]);
console.log(`Remaining — orders: ${remainingOrders.length}, auth users: ${users.users.length} (should reflect pre-existing state only)`);
