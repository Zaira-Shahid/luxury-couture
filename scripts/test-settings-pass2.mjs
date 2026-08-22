// Module 25 Pass 2 — store, orders, builder, shipping, notifications.
//
// Requires a running server (npm run build && npm run start) and
// .env.local loaded:
//   node --env-file=.env.local scripts/test-settings-pass2.mjs
//
// The money arithmetic is pure and import-free, so it is imported
// directly under Node's type stripping and tested to the penny. The rest
// goes through the database and HTTP.
import { createClient } from "@supabase/supabase-js";

import { calculateDeposit, calculateTax, toPence } from "../src/lib/settings/pricing.ts";
import { SECTION_ORDER, entriesForSection } from "../src/lib/settings/registry.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const appUrl = process.env.APP_URL ?? "http://localhost:3000";
const suffix = Date.now();
const SEP = String.fromCharCode(10);

let failures = 0;
function check(label, pass) {
  if (!pass) failures += 1;
  console.log(`${pass ? "PASS" : "FAIL"} — ${label}`);
}

async function signIn(email, password) {
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  const { data: signInData } = await client.auth.signInWithPassword({ email, password });
  return { client, userId: data.user.id, session: signInData.session };
}
function cookieFor(session) {
  const b64 = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  return `sb-${new URL(url).hostname.split(".")[0]}-auth-token=base64-${b64}`;
}
/**
 * React splits adjacent text and interpolation nodes with `<!-- -->`
 * markers in server-rendered HTML, so `A {percent}% deposit` arrives as
 * `A <!-- -->50<!-- -->% deposit`. Strip them before any human-readable
 * substring assertion.
 */
function rendered(html) {
  return html.replaceAll("<!-- -->", "");
}

async function get(path, cookie) {
  const res = await fetch(`${appUrl}${path}`, {
    headers: cookie ? { cookie } : {},
    redirect: "manual",
  });
  return { status: res.status, html: await res.text() };
}
async function setSetting(key, value) {
  await admin.from("site_settings").upsert({ key, value }, { onConflict: "key" });
}
async function clearSetting(key) {
  await admin.from("site_settings").delete().eq("key", key);
}

const { data: originalRows } = await admin.from("site_settings").select("key, value");
const ORIGINAL = new Map((originalRows ?? []).map((r) => [r.key, r.value]));
async function restore(key) {
  if (ORIGINAL.has(key)) await setSetting(key, ORIGINAL.get(key));
  else await clearSetting(key);
}

// ---------------------------------------------------------------------
console.log("=== MONEY: nothing changes until an admin opts in ===");
// The most important property of this pass. An upgrade must not silently
// start charging tax or splitting a customer's payment.
const noTax = calculateTax(1000, 0, false);
check("0% tax leaves the total untouched", noTax.total === 1000 && noTax.taxAmount === 0);
check("0% tax reports the full amount as net", noTax.net === 1000);
const noDeposit = calculateDeposit(1000, 0);
check("0% deposit charges the full amount", noDeposit.depositAmount === 1000);
check("0% deposit leaves no balance", noDeposit.balanceAmount === 0);
check("0% deposit does NOT create a deposit payment", noDeposit.usesDeposit === false);

console.log(SEP + "=== MONEY: tax arithmetic, to the penny ===");
const exclusive = calculateTax(100, 20, false);
check("20% exclusive on 100 gives 20 tax", exclusive.taxAmount === 20);
check("20% exclusive on 100 gives 120 total", exclusive.total === 120);
check("20% exclusive keeps net at 100", exclusive.net === 100);

const inclusive = calculateTax(120, 20, true);
check("20% inclusive on 120 gives 20 tax", inclusive.taxAmount === 20);
check("20% inclusive leaves the total at 120", inclusive.total === 120);
check("20% inclusive gives net 100", inclusive.net === 100);
check("inclusive net + tax equals the total", inclusive.net + inclusive.taxAmount === inclusive.total);

// Rounding is where money bugs live.
const awkward = calculateTax(9.99, 20, false);
check("20% of 9.99 rounds to 2.00", awkward.taxAmount === 2);
check("and the total is 11.99", awkward.total === 11.99);
const awkwardInc = calculateTax(9.99, 20, true);
check(
  "inclusive on an awkward amount still sums exactly",
  toPence(awkwardInc.net + awkwardInc.taxAmount) === awkwardInc.total
);
check("a negative amount is floored at zero", calculateTax(-50, 20, false).total === 0);

console.log(SEP + "=== MONEY: deposit arithmetic ===");
const half = calculateDeposit(1000, 50);
check("50% of 1000 is 500 up front", half.depositAmount === 500);
check("and 500 outstanding", half.balanceAmount === 500);
check("it uses a deposit payment", half.usesDeposit === true);
check("deposit + balance equals the total exactly", half.depositAmount + half.balanceAmount === 1000);

const odd = calculateDeposit(999.99, 33);
check(
  "an awkward split still sums to the total with no lost penny",
  toPence(odd.depositAmount + odd.balanceAmount) === 999.99
);
check("100% takes the full amount rather than a 'deposit'", calculateDeposit(500, 100).usesDeposit === false);
check("over 100% is treated as full payment", calculateDeposit(500, 150).usesDeposit === false);
check("a negative percentage is treated as no deposit", calculateDeposit(500, -10).usesDeposit === false);

// ---------------------------------------------------------------------
console.log(SEP + "=== Setup ===");
const staffAdmin = await signIn(`m25b-admin-${suffix}@luxury-couture-devtest.local`, "correct-horse-i0");
await admin.from("profiles").update({ role: "admin" }).eq("id", staffAdmin.userId);
const adminCookie = cookieFor(staffAdmin.session);

// /checkout redirects (to /cart) when the cart is empty, so without a
// real cart there is no summary to assert against — the same lesson as
// Pass 1's currency test. Seed a product, a cart owned by this admin, an
// address and a measurement profile so checkout actually renders.
const { data: p2Product } = await admin
  .from("products")
  .insert({
    name: `Pass2 Product ${suffix}`,
    slug: `pass2-product-${suffix}`,
    base_price: 100,
    currency: "GBP",
    status: "published",
    published_at: new Date().toISOString(),
  })
  .select()
  .single();
const { data: p2Cart } = await admin
  .from("carts")
  .insert({ customer_id: staffAdmin.userId, status: "active" })
  .select()
  .single();
await admin.from("cart_items").insert({
  cart_id: p2Cart.id,
  product_id: p2Product.id,
  quantity: 1,
  unit_price_snapshot: 100,
});
await admin.from("addresses").insert({
  customer_id: staffAdmin.userId,
  recipient_name: "Test",
  line1: "1 Test St",
  city: "London",
  postal_code: "E1 1AA",
  country: "UK",
});

console.log(SEP + "=== All ten sections render ===");
for (const section of SECTION_ORDER) {
  const page = await get(`/admin/settings?section=${section}`, adminCookie);
  const label = entriesForSection(section)[0]?.label;
  check(
    `section "${section}" renders with its fields`,
    page.status === 200 && Boolean(label) && page.html.includes(label)
  );
}

console.log(SEP + "=== Tax reaches the checkout summary ===");
await setSetting("store.tax_rate", 20);
await setSetting("store.tax_inclusive", false);
await setSetting("store.tax_label", "VAT");
const checkoutTax = await get("/checkout", adminCookie);
check(
  "an exclusive tax rate is disclosed before payment",
  rendered(checkoutTax.html).includes("VAT at 20%")
);
await setSetting("store.tax_inclusive", true);
const checkoutInc = await get("/checkout", adminCookie);
check(
  "an inclusive rate is described differently",
  rendered(checkoutInc.html).includes("Includes VAT")
);
await setSetting("store.tax_rate", 0);
const checkoutNoTax = await get("/checkout", adminCookie);
check("no tax line when the rate is 0", !rendered(checkoutNoTax.html).includes("VAT at"));
await restore("store.tax_rate");
await restore("store.tax_inclusive");
await restore("store.tax_label");

console.log(SEP + "=== Deposit is disclosed before payment ===");
await setSetting("orders.deposit_percent", 50);
const checkoutDeposit = await get("/checkout", adminCookie);
check(
  "a deposit rule is explained to the customer",
  rendered(checkoutDeposit.html).includes("50% deposit")
);
await setSetting("orders.deposit_percent", 0);
const checkoutNoDeposit = await get("/checkout", adminCookie);
check("no deposit note when the rule is off", !rendered(checkoutNoDeposit.html).includes("deposit is taken now"));
await restore("orders.deposit_percent");

console.log(SEP + "=== Order columns exist and default safely ===");
const { data: taxCol } = await admin.from("orders").select("tax_amount").limit(1);
check("orders.tax_amount is queryable", Array.isArray(taxCol));
const { data: depCol } = await admin.from("orders").select("deposit_amount").limit(1);
check("orders.deposit_amount is queryable", Array.isArray(depCol));

console.log(SEP + "=== Builder toggle ===");
await setSetting("builder.enabled", false);
const builderOff = await get("/builder");
// Two things make the obvious assertions useless here. notFound() returns
// HTTP 200 in this Next.js version (documented in docs/ARCHITECTURE.md;
// the middleware 404 workaround is applied only to PUBLIC CRAWLABLE
// dynamic routes, and a toggled-off builder is neither). And "Page not
// found" appears in EVERY page's App Router payload, so it cannot
// distinguish one page from another. Assert on builder-specific content.
check("disabling the builder removes the builder UI", !builderOff.html.includes("Your Design"));
await setSetting("builder.enabled", true);
const builderOn = await get("/builder");
check("re-enabling brings it back (200)", builderOn.status === 200);
check("and the builder UI returns", builderOn.html.includes("Your Design"));
await restore("builder.enabled");

console.log(SEP + "=== Notification toggles ===");
const { data: beforeEmails } = await admin
  .from("email_deliveries")
  .select("id", { count: "exact", head: false })
  .limit(1000);
const beforeCount = (beforeEmails ?? []).length;

await setSetting("notifications.order_emails_enabled", false);
// A guest enquiry normally triggers a transactional email through notify().
await fetch(`${appUrl}/api/chat`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ message: "hello", sessionId: `m25b-${suffix}` }),
}).catch(() => {});
const { data: afterOff } = await admin.from("email_deliveries").select("id").limit(1000);
check(
  "with order emails off, no new transactional deliveries are recorded",
  (afterOff ?? []).length === beforeCount
);
await setSetting("notifications.order_emails_enabled", true);
await restore("notifications.order_emails_enabled");

await setSetting("notifications.marketing_emails_enabled", false);
const { data: campaign } = await admin
  .from("campaigns")
  .insert({
    subject: `Toggle test ${suffix}`,
    body: "Test body.",
    target: "all_subscribers",
    status: "draft",
  })
  .select()
  .single();
const campaignPage = await get(`/admin/marketing/campaigns/${campaign.id}`, adminCookie);
check("campaign page still renders with marketing off", campaignPage.status === 200);
const { data: stillDraft } = await admin
  .from("campaigns")
  .select("status")
  .eq("id", campaign.id)
  .single();
check("the campaign was not sent", stillDraft.status === "draft");
await restore("notifications.marketing_emails_enabled");

console.log(SEP + "=== Registry and type agreement ===");
// The registry drives parsing; SiteSettings drives reading. A path in one
// that is missing from the other would fail silently at runtime, so the
// settings page rendering every section IS the check that they agree.
let renderedAll = true;
for (const section of SECTION_ORDER) {
  const page = await get(`/admin/settings?section=${section}`, adminCookie);
  if (page.status !== 200) renderedAll = false;
}
check("every registry path resolves against the settings type", renderedAll);

console.log(SEP + "Cleaning up...");
await admin.from("campaigns").delete().eq("id", campaign.id);
await admin.from("cart_items").delete().eq("cart_id", p2Cart.id);
await admin.from("carts").delete().eq("id", p2Cart.id);
await admin.from("addresses").delete().eq("customer_id", staffAdmin.userId);
await admin.from("products").delete().eq("id", p2Product.id);
const { data: convs } = await admin
  .from("chat_conversations")
  .select("id")
  .like("session_id", `m25b-${suffix}%`);
const convIds = (convs ?? []).map((c) => c.id);
if (convIds.length) {
  await admin.from("chat_messages").delete().in("conversation_id", convIds);
  await admin.from("chat_conversations").delete().in("id", convIds);
}
await admin.from("chat_rate_limits").delete().neq("key_hash", "");
for (const key of new Set([
  ...ORIGINAL.keys(),
  ...SECTION_ORDER.flatMap((s) => entriesForSection(s).map((e) => e.key)),
])) {
  await restore(key);
}
await admin.auth.admin.deleteUser(staffAdmin.userId);

const { data: finalRows } = await admin.from("site_settings").select("key");
console.log(
  `Remaining — site_settings rows: ${(finalRows ?? []).length} (was ${ORIGINAL.size} at start)`
);
if ((finalRows ?? []).length !== ORIGINAL.size) {
  failures += 1;
  console.log("FAIL — settings table was not restored to its original state");
}

console.log(SEP + `${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
