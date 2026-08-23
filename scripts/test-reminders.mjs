// Module 27 Pass 2 — the reminder cron.
//
// The property that matters here is NOT "a reminder gets sent" — it is
// "a reminder gets sent exactly once". A chase-up email delivered three
// times because a cron overlapped is worse than one never delivered, so
// the duplicate-suppression checks are the substantive half.
//
//   node --env-file=.env.local scripts/test-reminders.mjs
//
// Needs a running production server: the cron is an HTTP route.
import { createClient } from "@supabase/supabase-js";

import { purgeDevtestData } from "./lib/purge-devtest.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let passed = 0;
let failed = 0;
let skipped = 0;
function check(label, ok) {
  console.log(`${ok ? "PASS" : "FAIL"} — ${label}`);
  if (ok) passed += 1;
  else failed += 1;
}
function skip(label, why) {
  console.log(`SKIP — ${label} (${why})`);
  skipped += 1;
}

const suffix = Date.now();
const createdUsers = [];

async function makeCustomer(label) {
  const email = `m27r-${label}-${suffix}@luxury-couture-devtest.local`;
  const password = `m27r-${label}-${suffix}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser(${label}): ${error.message}`);
  createdUsers.push(data.user.id);

  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  await client.auth.signInWithPassword({ email, password });
  return { id: data.user.id, email, client };
}

async function runCron() {
  // MODULE 29: the cron now FAILS CLOSED — 401 for a bad token, 503 when
  // no CRON_SECRET is configured at all. An unauthenticated call used to
  // work and no longer does, which is the whole point of that change, so
  // this sends the secret the way Vercel Cron does.
  const res = await fetch(`${APP_URL}/api/cron/reminders`, {
    headers: process.env.CRON_SECRET
      ? { authorization: `Bearer ${process.env.CRON_SECRET}` }
      : {},
    redirect: "manual",
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

// Idempotent setup — see scripts/lib/purge-devtest.mjs. A crashed
// earlier run must not become this run's input.
const purged = await purgeDevtestData(admin);
if (purged > 0) console.log(`(purged ${purged} leaked dev-test account(s) from a previous run)`);

const customer = await makeCustomer("customer");
await new Promise((r) => setTimeout(r, 400));

// Wipe the welcome notification so counts below are unambiguous.
await admin.from("notifications").delete().eq("profile_id", customer.id);

// ---------------------------------------------------------------------
console.log("\n# Setup — an old order with a balance, and an appointment tomorrow");

const { data: address } = await admin
  .from("addresses")
  .insert({
    customer_id: customer.id,
    recipient_name: "Reminder Test",
    line1: "1 Test St",
    city: "London",
    postal_code: "E1 1AA",
    country: "UK",
  })
  .select()
  .single();

// Backdated 30 days: comfortably past PAYMENT_REMINDER_AFTER_DAYS.
const { data: owingOrder } = await admin
  .from("orders")
  .insert({
    customer_id: customer.id,
    shipping_address_id: address.id,
    status: "confirmed",
    subtotal: 1000,
    total_amount: 1000,
    balance_due_amount: 400,
    created_at: new Date(Date.now() - 30 * 86_400_000).toISOString(),
  })
  .select("id, order_number")
  .single();

// A settled order, and a cancelled one with a balance. Neither should be
// chased — the negative cases are what stop this from spamming everyone.
const { data: settledOrder } = await admin
  .from("orders")
  .insert({
    customer_id: customer.id,
    shipping_address_id: address.id,
    status: "confirmed",
    subtotal: 500,
    total_amount: 500,
    balance_due_amount: 0,
    created_at: new Date(Date.now() - 30 * 86_400_000).toISOString(),
  })
  .select("id")
  .single();

const { data: cancelledOrder } = await admin
  .from("orders")
  .insert({
    customer_id: customer.id,
    shipping_address_id: address.id,
    status: "cancelled",
    subtotal: 500,
    total_amount: 500,
    balance_due_amount: 500,
    created_at: new Date(Date.now() - 30 * 86_400_000).toISOString(),
  })
  .select("id")
  .single();

// A recent order with a balance: real debt, but too soon to chase.
const { data: freshOrder } = await admin
  .from("orders")
  .insert({
    customer_id: customer.id,
    shipping_address_id: address.id,
    status: "confirmed",
    subtotal: 500,
    total_amount: 500,
    balance_due_amount: 500,
  })
  .select("id")
  .single();

const { data: appointment } = await admin
  .from("appointments")
  .insert({
    customer_id: customer.id,
    type: "consultation",
    status: "confirmed",
    contact_name: "Reminder Test",
    contact_email: customer.email,
    scheduled_at: new Date(Date.now() + 24 * 3_600_000).toISOString(),
  })
  .select("id")
  .single();

// Outside the 48h window, and one that was never confirmed.
const { data: farAppointment } = await admin
  .from("appointments")
  .insert({
    customer_id: customer.id,
    type: "fitting",
    status: "confirmed",
    contact_name: "Reminder Test",
    contact_email: customer.email,
    scheduled_at: new Date(Date.now() + 10 * 86_400_000).toISOString(),
  })
  .select("id")
  .single();

const { data: unconfirmedAppointment } = await admin
  .from("appointments")
  .insert({
    customer_id: customer.id,
    type: "consultation",
    status: "requested",
    contact_name: "Reminder Test",
    contact_email: customer.email,
    scheduled_at: new Date(Date.now() + 24 * 3_600_000).toISOString(),
  })
  .select("id")
  .single();

// A GUEST booking — no account, but appointments carry their own
// contact_email (0028) precisely so a guest is contactable. This is the
// case the first version of the cron wrongly skipped.
const { data: guestAppointment } = await admin
  .from("appointments")
  .insert({
    customer_id: null,
    type: "consultation",
    status: "confirmed",
    contact_name: "Guest Booker",
    contact_email: `m27r-guest-${suffix}@example.com`,
    scheduled_at: new Date(Date.now() + 24 * 3_600_000).toISOString(),
  })
  .select("id")
  .single();

check("seeded the fixtures", !!owingOrder && !!appointment && !!guestAppointment);

// ---------------------------------------------------------------------
console.log("\n# First run");

const first = await runCron();
check("the cron route responds 200", first.status === 200);
check("it reports what it sent", typeof first.body?.paymentsSent === "number");

const { data: afterFirst } = await admin
  .from("notifications")
  .select("type, link, category")
  .eq("profile_id", customer.id);

const paymentReminders = (afterFirst ?? []).filter((n) => n.type === "payment_reminder");
const consultationReminders = (afterFirst ?? []).filter(
  (n) => n.type === "consultation_reminder"
);

check("the overdue balance produced exactly one reminder", paymentReminders.length === 1);
check("the appointment produced exactly one reminder", consultationReminders.length === 1);
check(
  "the payment reminder is filed under payments",
  paymentReminders[0]?.category === "payments"
);
check(
  "the payment reminder deep-links to its order",
  paymentReminders[0]?.link === `/account/orders/${owingOrder.id}`
);
check(
  "the consultation reminder is filed under consultations",
  consultationReminders[0]?.category === "consultations"
);

// ---------------------------------------------------------------------
console.log("\n# Nothing else was chased");

const { data: ledger } = await admin
  .from("notification_reminders")
  .select("entity_type, entity_id, kind");
const claimedIds = new Set((ledger ?? []).map((r) => r.entity_id));

check("a settled order is not chased", !claimedIds.has(settledOrder.id));
check("a cancelled order is not chased", !claimedIds.has(cancelledOrder.id));
check("a recent order is not chased yet", !claimedIds.has(freshOrder.id));
check("an appointment outside the window is not reminded", !claimedIds.has(farAppointment.id));
check(
  "an unconfirmed appointment is not reminded",
  !claimedIds.has(unconfirmedAppointment.id)
);

// The guest case, both halves: claimed and emailed, but no in-app row,
// because there is no account to file one against.
check("a guest appointment IS reminded", claimedIds.has(guestAppointment.id));
const { data: guestNotifications } = await admin
  .from("notifications")
  .select("id")
  .is("profile_id", null);
check(
  "a guest reminder writes no in-app row (there is no inbox for it)",
  (guestNotifications?.length ?? 0) === 0
);

// ---------------------------------------------------------------------
console.log("\n# Running it again sends nothing — the point of the ledger");

const second = await runCron();
check("the second run also succeeds", second.status === 200);
check("the second run sends no payment reminders", second.body?.paymentsSent === 0);
check("the second run sends no appointment reminders", second.body?.appointmentsSent === 0);

const { data: afterSecond } = await admin
  .from("notifications")
  .select("type")
  .eq("profile_id", customer.id);
check(
  "no duplicate notification was written",
  (afterSecond ?? []).filter((n) => n.type === "payment_reminder").length === 1 &&
    (afterSecond ?? []).filter((n) => n.type === "consultation_reminder").length === 1
);

// Concurrency: the primary key, not a timestamp read a moment ago, is
// what makes this safe. Two simultaneous runs must not both send.
await admin.from("notification_reminders").delete().eq("entity_id", appointment.id);
const [runA, runB] = await Promise.all([runCron(), runCron()]);
const totalAppointments =
  (runA.body?.appointmentsSent ?? 0) + (runB.body?.appointmentsSent ?? 0);
check(
  "two concurrent runs send the appointment reminder exactly once",
  totalAppointments === 1
);

// ---------------------------------------------------------------------
console.log("\n# The ledger itself");

const { data: appointmentClaim } = await admin
  .from("notification_reminders")
  .select("kind")
  .eq("entity_id", appointment.id);
check(
  "an appointment is claimed once, with no period suffix",
  appointmentClaim?.length === 1 && appointmentClaim[0].kind === "consultation_reminder"
);

const { data: orderClaim } = await admin
  .from("notification_reminders")
  .select("kind")
  .eq("entity_id", owingOrder.id);
check(
  "an order claim carries the period, so it can recur later",
  orderClaim?.length === 1 && /^payment_reminder_\d+$/.test(orderClaim[0].kind)
);

// A later period is a different key, so a balance can be chased again.
const { error: laterPeriodErr } = await admin
  .from("notification_reminders")
  .insert({ entity_type: "order", entity_id: owingOrder.id, kind: "payment_reminder_99" });
check("a later period is a separate claim", !laterPeriodErr);

const { error: duplicateErr } = await admin
  .from("notification_reminders")
  .insert({ entity_type: "order", entity_id: owingOrder.id, kind: "payment_reminder_99" });
check("the same claim twice is rejected by the primary key", !!duplicateErr);

const { error: badTypeErr } = await admin
  .from("notification_reminders")
  .insert({ entity_type: "invoice", entity_id: owingOrder.id, kind: "x" });
check("the entity_type CHECK rejects an unknown kind of entity", !!badTypeErr);

// ---------------------------------------------------------------------
console.log("\n# The ledger is not customer-readable");

const { data: customerSeesLedger } = await customer.client
  .from("notification_reminders")
  .select("kind");
check(
  "a customer cannot read the reminder ledger",
  (customerSeesLedger?.length ?? 0) === 0
);

const anon = createClient(url, anonKey);
const { data: anonSeesLedger } = await anon.from("notification_reminders").select("kind");
check("a signed-out visitor cannot read it either", (anonSeesLedger?.length ?? 0) === 0);

// ---------------------------------------------------------------------
console.log("\n# Authorization");

if (process.env.CRON_SECRET) {
  const res = await fetch(`${APP_URL}/api/cron/reminders`, {
    headers: { authorization: "Bearer wrong-secret" },
    redirect: "manual",
  });
  check("a wrong CRON_SECRET is rejected", res.status === 401);
} else {
  // Documented rather than hidden: the same gap Module 21's cron tests
  // record. With CRON_SECRET unset the route deliberately skips the
  // check, so there is nothing to assert here — and that is exactly why
  // it must be set before deploy.
  skip("a wrong CRON_SECRET is rejected", "CRON_SECRET is not set locally");
}

// ---------------------------------------------------------------------
console.log("\nCleaning up...");
await admin.from("notification_reminders").delete().in("entity_id", [
  owingOrder.id,
  settledOrder.id,
  cancelledOrder.id,
  freshOrder.id,
  appointment.id,
  farAppointment.id,
  unconfirmedAppointment.id,
  guestAppointment.id,
]);
await admin.from("notifications").delete().eq("profile_id", customer.id);
await admin
  .from("appointments")
  .delete()
  .in("id", [
    appointment.id,
    farAppointment.id,
    unconfirmedAppointment.id,
    guestAppointment.id,
  ]);
await admin
  .from("orders")
  .delete()
  .in("id", [owingOrder.id, settledOrder.id, cancelledOrder.id, freshOrder.id]);
await admin.from("addresses").delete().eq("id", address.id);
for (const id of createdUsers) await admin.auth.admin.deleteUser(id);

console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped`);
process.exit(failed === 0 ? 0 : 1);
