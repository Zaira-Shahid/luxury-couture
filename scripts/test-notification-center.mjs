// Module 27 Pass 1 — the customer notification centre.
//
// A NEW script rather than an extension of test-notifications.mjs, which
// covers Module 15's dispatch. Keeping that one untouched is what lets
// run-suite.mjs --diff hold it to identical counts; a module that edits
// the script it is also meant to be measured against has no regression
// gate at all.
//
//   node --env-file=.env.local scripts/test-notification-center.mjs
//
// Needs a running production server for the render section.
import { createClient } from "@supabase/supabase-js";

import {
  NOTIFICATION_CATEGORIES,
  TYPE_CATEGORIES,
  categoryForType,
  linkForNotification,
} from "../src/lib/notifications/categories.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let passed = 0;
let failed = 0;
function check(label, ok) {
  console.log(`${ok ? "PASS" : "FAIL"} — ${label}`);
  if (ok) passed += 1;
  else failed += 1;
}

const suffix = Date.now();
const created = [];

async function signIn(label) {
  const email = `m27-${label}-${suffix}@luxury-couture-devtest.local`;
  const password = `m27-test-${label}-${suffix}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser(${label}): ${error.message}`);

  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: session, error: signInErr } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (signInErr) throw new Error(`signIn(${label}): ${signInErr.message}`);

  created.push(data.user.id);
  return { client, id: data.user.id, email, session: session.session };
}

const alice = await signIn("alice");
const bob = await signIn("bob");
await new Promise((r) => setTimeout(r, 400));

// ---------------------------------------------------------------------
console.log("\n# Schema");

const { error: badCategoryErr } = await admin.from("notifications").insert({
  profile_id: alice.id,
  type: "order_confirmed",
  title: "Bad",
  body: "Bad",
  channel: "in_app",
  category: "not_a_category",
});
check("the category CHECK constraint rejects an unknown value", !!badCategoryErr);

// Nullable on purpose: notify() has 18 call sites and a NOT NULL column
// would have broken every one at once.
const { error: nullCategoryErr } = await admin.from("notifications").insert({
  profile_id: alice.id,
  type: "something_new",
  title: "Unclassified",
  body: "No category",
  channel: "in_app",
});
check("a notification with no category still inserts", !nullCategoryErr);

for (const category of NOTIFICATION_CATEGORIES) {
  const { error } = await admin.from("notifications").insert({
    profile_id: alice.id,
    type: "order_confirmed",
    title: `Cat ${category}`,
    body: "x",
    channel: "in_app",
    category,
  });
  check(`the database accepts category '${category}'`, !error);
}
await admin.from("notifications").delete().eq("profile_id", alice.id);

// ---------------------------------------------------------------------
console.log("\n# The code mirror agrees with the database");

// categories.ts mirrors 0056's constraint and backfill. Where they
// disagree the database wins, so the mirror is what gets checked.
const mirrorMismatches = Object.entries(TYPE_CATEGORIES).filter(
  ([, category]) => !NOTIFICATION_CATEGORIES.includes(category)
);
check(
  `every mapped type points at a real category${
    mirrorMismatches.length ? ` — ${mirrorMismatches.map(([t]) => t).join(", ")}` : ""
  }`,
  mirrorMismatches.length === 0
);

check("a known type resolves to its category", categoryForType("shipped") === "shipping");
check("an unknown type resolves to null, not a default", categoryForType("who_knows") === null);
check(
  "an unclassified notification is never suppressed (null category = always delivered)",
  categoryForType("who_knows") === null && linkForNotification(null) === null
);
check(
  "an order notification deep-links to the order",
  linkForNotification("orders", "abc-123") === "/account/orders/abc-123"
);
check(
  "without an entity id it links to the section instead of a broken URL",
  linkForNotification("orders") === "/account/orders"
);
check(
  "consultations link to the consultations page",
  linkForNotification("consultations") === "/account/consultations"
);

// ---------------------------------------------------------------------
console.log("\n# wants_email() — the gate notify() actually consults");

async function wantsEmail(who, profileId, category) {
  const { data, error } = await who.client.rpc("wants_email", {
    p_profile_id: profileId,
    p_category: category,
  });
  if (error) throw new Error(`wants_email: ${error.message}`);
  return data;
}

check(
  "with no preference row at all, email is ON (absent = opted in)",
  (await wantsEmail(alice, alice.id, "orders")) === true
);
check(
  "a null category is always delivered",
  (await wantsEmail(alice, alice.id, null)) === true
);
check("a null profile is always delivered", (await wantsEmail(alice, null, "orders")) === true);

await alice.client
  .from("notification_preferences")
  .upsert({ profile_id: alice.id, category: "orders", email_enabled: false });
check(
  "after opting out, wants_email says no",
  (await wantsEmail(alice, alice.id, "orders")) === false
);
check(
  "opting out of one category does not affect another",
  (await wantsEmail(alice, alice.id, "shipping")) === true
);

await alice.client
  .from("notification_preferences")
  .upsert({ profile_id: alice.id, category: "orders", email_enabled: true });
check(
  "opting back in restores it",
  (await wantsEmail(alice, alice.id, "orders")) === true
);

// SECURITY DEFINER, so it must give the same answer regardless of who is
// asking — the reminder cron in Pass 2 calls it with the service-role
// client, not a user session.
await alice.client
  .from("notification_preferences")
  .upsert({ profile_id: alice.id, category: "payments", email_enabled: false });
const { data: asService } = await admin.rpc("wants_email", {
  p_profile_id: alice.id,
  p_category: "payments",
});
check("the service-role client gets the same answer as the user", asService === false);

// ---------------------------------------------------------------------
console.log("\n# Preferences are private to their owner");

const { data: bobReadingAlice } = await bob.client
  .from("notification_preferences")
  .select("category")
  .eq("profile_id", alice.id);
check("bob cannot read alice's preferences", (bobReadingAlice?.length ?? 0) === 0);

const { error: bobWritingAlice } = await bob.client
  .from("notification_preferences")
  .insert({ profile_id: alice.id, category: "shipping", email_enabled: false });
check("bob cannot write a preference for alice", !!bobWritingAlice);

// The write RLS refuses silently on UPDATE (zero rows), so this asserts
// the VALUE rather than the error.
await bob.client
  .from("notification_preferences")
  .update({ email_enabled: true })
  .eq("profile_id", alice.id)
  .eq("category", "payments");
const { data: stillMuted } = await admin
  .from("notification_preferences")
  .select("email_enabled")
  .eq("profile_id", alice.id)
  .eq("category", "payments")
  .single();
check("bob cannot flip alice's existing preference", stillMuted?.email_enabled === false);

const anon = createClient(url, anonKey);
const { data: anonPrefs } = await anon.from("notification_preferences").select("category").limit(1);
check("a signed-out visitor sees no preferences at all", (anonPrefs?.length ?? 0) === 0);

// ---------------------------------------------------------------------
console.log("\n# The feed, the unread count and the deep link");

const { data: aliceOrderAddress } = await admin
  .from("addresses")
  .insert({
    customer_id: alice.id,
    recipient_name: "Alice",
    line1: "1 Test St",
    city: "London",
    postal_code: "E1 1AA",
    country: "UK",
  })
  .select()
  .single();
const { data: aliceOrder } = await admin
  .from("orders")
  .insert({
    customer_id: alice.id,
    shipping_address_id: aliceOrderAddress.id,
    status: "confirmed",
    subtotal: 500,
    total_amount: 500,
    balance_due_amount: 500,
  })
  .select("id, order_number")
  .single();

// Enough rows to exercise pagination (PAGE_SIZE is 20) and the per-
// category chips.
//
// Timestamps are set explicitly and one minute apart. A batch insert
// otherwise gives all 26 rows an identical created_at, and asserting an
// ORDER over rows that have no order is a test that passes or fails by
// luck. (Doing it the lazy way first is what surfaced the real
// pagination bug this seeding now guards: see the `id` tiebreaker in
// get-notifications.ts.)
const base = Date.now();
const seeded = [];
for (let i = 0; i < 25; i += 1) {
  seeded.push({
    profile_id: alice.id,
    type: "order_status_changed",
    title: `Order update ${i}`,
    body: `Body ${i}`,
    channel: "in_app",
    category: "orders",
    link: `/account/orders/${aliceOrder.id}`,
    created_at: new Date(base + i * 60_000).toISOString(),
  });
}
seeded.push({
  profile_id: alice.id,
  type: "shipped",
  title: "Shipped notification",
  body: "On its way",
  channel: "in_app",
  category: "shipping",
  link: `/account/orders/${aliceOrder.id}`,
  created_at: new Date(base + 25 * 60_000).toISOString(),
});
const { error: seedErr } = await admin.from("notifications").insert(seeded);
check("seeded the feed", !seedErr);

const { count: unreadCount } = await alice.client
  .from("notifications")
  .select("id", { count: "exact", head: true })
  .eq("profile_id", alice.id)
  .is("read_at", null);
// 26 seeded. The welcome notification handle_new_user() writes was
// removed by the schema section's cleanup above, so this is the whole
// feed rather than 27.
check(`unread count reflects every unread row (${unreadCount})`, unreadCount === 26);

const { data: bobSeesAlice } = await bob.client
  .from("notifications")
  .select("id")
  .eq("profile_id", alice.id);
check("bob cannot see alice's notifications", (bobSeesAlice?.length ?? 0) === 0);

// ---------------------------------------------------------------------
console.log("\n# Rendering, over HTTP with a real session cookie");

function sessionCookie(session) {
  const ref = new URL(url).hostname.split(".")[0];
  const encoded = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  return "sb-" + ref + "-auth-token=base64-" + encoded;
}

const cookie = sessionCookie(alice.session);
async function get(path) {
  const res = await fetch(APP_URL + path, { headers: { cookie }, redirect: "manual" });
  return { status: res.status, html: await res.text() };
}

// React interpolation leaves <!-- --> markers between text nodes, which
// break a naive substring check. Established stripper from Module 25.
const rendered = (html) => html.replaceAll("<!-- -->", "");

const feedPage = await get("/account/notifications");
check("the notifications page renders", feedPage.status === 200);
check(
  "it reports the unread count",
  rendered(feedPage.html).includes("26 unread updates")
);
check("it shows a seeded notification", feedPage.html.includes("Order update 24"));
check(
  "a notification deep-links to its order",
  feedPage.html.includes(`/account/orders/${aliceOrder.id}`)
);
check("category filter chips render", feedPage.html.includes("Shipping"));
check("pagination appears past one page", rendered(feedPage.html).includes("Page 1 of 2"));
check("the mark-all control is offered", feedPage.html.includes("Mark all read"));

const page2 = await get("/account/notifications?page=2");
check("page 2 shows the older rows", page2.html.includes("Order update 0"));
check("page 2 does not repeat page 1", !page2.html.includes("Order update 24"));

const shippingOnly = await get("/account/notifications?category=shipping");
check("the category filter narrows the feed", shippingOnly.html.includes("Shipped notification"));
check(
  "the category filter excludes other categories",
  !shippingOnly.html.includes("Order update 24")
);
check(
  "filtering changes the mark-all control to a scoped one",
  shippingOnly.html.includes("Mark section read")
);

// The badge in the shared account nav.
const ordersPage = await get("/account/orders");
check("the unread badge appears in the account nav", ordersPage.html.includes("26 unread"));

// Mark one read and confirm the count moves.
const { data: oneRow } = await admin
  .from("notifications")
  .select("id")
  .eq("profile_id", alice.id)
  .eq("title", "Shipped notification")
  .single();
await alice.client
  .from("notifications")
  .update({ read_at: new Date().toISOString() })
  .eq("id", oneRow.id);
const afterRead = await get("/account/notifications");
check("marking one read decrements the count", rendered(afterRead.html).includes("25 unread"));

const unreadOnly = await get("/account/notifications?unread=1");
check(
  "the unread-only filter hides what was just read",
  !unreadOnly.html.includes("Shipped notification")
);

// ---------------------------------------------------------------------
console.log("\n# The preferences screen");

const prefsPage = await get("/account/notifications/preferences");
check("the preferences page renders", prefsPage.status === 200);
for (const category of NOTIFICATION_CATEGORIES) {
  check(
    `it offers a toggle for '${category}'`,
    prefsPage.html.includes(`value="${category}"`)
  );
}
check(
  "it states plainly that the in-app feed cannot be switched off",
  rendered(prefsPage.html).includes("cannot be switched off")
);
check(
  "marketing is surfaced here too",
  prefsPage.html.includes("New collections and offers")
);

// Marketing lives on profiles.marketing_opt_out (Module 24), NOT in
// notification_preferences — one question, one source of truth.
const { data: marketingRow } = await admin
  .from("notification_preferences")
  .select("category")
  .eq("profile_id", alice.id)
  .eq("category", "marketing");
check(
  "marketing is not duplicated into notification_preferences",
  (marketingRow?.length ?? 0) === 0
);

// ---------------------------------------------------------------------
console.log("\nCleaning up...");
await admin.from("notifications").delete().in("profile_id", [alice.id, bob.id]);
await admin.from("notification_preferences").delete().in("profile_id", [alice.id, bob.id]);
await admin.from("orders").delete().eq("id", aliceOrder.id);
await admin.from("addresses").delete().eq("id", aliceOrderAddress.id);
for (const id of created) await admin.auth.admin.deleteUser(id);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
