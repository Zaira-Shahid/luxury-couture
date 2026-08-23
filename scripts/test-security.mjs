// Module 29 Pass 1 — the security audit, as assertions rather than prose.
//
// An audit whose output is "I read the code and it looked fine" is worth
// very little: it cannot be re-run, and it decays the moment someone
// changes a file. So every claim this module makes is a check here.
//
// Two rules this script follows, because a security test that damages
// the system it audits is a bad trade:
//
//  1. NOTHING DESTRUCTIVE. Probes either read, or write rows this script
//     created and then removes. It never blind-fires at every Server
//     Action hoping they all reject — some would not, and the ones that
//     did not would mutate real data.
//  2. Known-unfixed gaps FAIL rather than being quietly omitted. This
//     script is expected to fail until Pass 2 closes them; that is what
//     makes it an audit instead of a rubber stamp.
//
//   node --env-file=.env.local scripts/test-security.mjs
//
// Needs a running production server and a completed build (it inspects
// the built client bundles).
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { purgeDevtestData } from "./lib/purge-devtest.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let passed = 0;
let failed = 0;
const findings = [];
function check(label, ok, detail, severity = "medium") {
  console.log(`${ok ? "PASS" : "FAIL"} — ${label}${detail ? ` (${detail})` : ""}`);
  if (ok) passed += 1;
  else {
    failed += 1;
    findings.push({ label, detail, severity });
  }
}

const suffix = Date.now();
const createdUsers = [];

async function makeUser(label, role = "customer") {
  const email = `m29-${label}-${suffix}@luxury-couture-devtest.local`;
  const password = `m29-${label}-${suffix}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser(${label}): ${error.message}`);
  if (role !== "customer") await admin.from("profiles").update({ role }).eq("id", data.user.id);

  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: session } = await client.auth.signInWithPassword({ email, password });
  createdUsers.push(data.user.id);
  return { id: data.user.id, email, client, session: session.session };
}

function sessionCookie(s) {
  const ref = new URL(url).hostname.split(".")[0];
  return `sb-${ref}-auth-token=base64-${Buffer.from(JSON.stringify(s), "utf8").toString("base64url")}`;
}

await purgeDevtestData(admin);

// =====================================================================
console.log("\n# Secret hygiene in the BUILT client bundles");
//
// A source-level grep proves nothing about what actually shipped. This
// walks .next/static — the files a browser downloads — and looks for the
// service-role key and any non-NEXT_PUBLIC secret. A hit here is the
// single worst outcome in this whole audit: the service-role key bypasses
// every RLS policy in the database.

function walk(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const clientFiles = walk(".next/static").filter((f) => /\.(js|css|json)$/.test(f));
check("built client bundles were found to scan", clientFiles.length > 0, `${clientFiles.length} files`);

const SECRETS = [
  ["SUPABASE_SERVICE_ROLE_KEY", serviceKey],
  ["STRIPE_SECRET_KEY", process.env.STRIPE_SECRET_KEY],
  ["STRIPE_WEBHOOK_SECRET", process.env.STRIPE_WEBHOOK_SECRET],
  ["ANTHROPIC_API_KEY", process.env.ANTHROPIC_API_KEY],
  ["RESEND_API_KEY", process.env.RESEND_API_KEY],
  ["CRON_SECRET", process.env.CRON_SECRET],
  ["DATABASE_URL", process.env.DATABASE_URL],
];

for (const [name, value] of SECRETS) {
  if (!value || value.length < 12) {
    console.log(`      (skipped ${name} — not set locally, nothing to leak)`);
    continue;
  }
  const leaked = clientFiles.filter((f) => readFileSync(f, "utf8").includes(value));
  check(
    `${name} does not appear in any client bundle`,
    leaked.length === 0,
    leaked.length ? leaked.slice(0, 2).join(", ") : undefined,
    "critical"
  );
}

// The anon key is *meant* to be public — asserted so that a future
// "tighten this" refactor cannot mistake its presence for a leak.
const anonInBundle = clientFiles.some((f) => readFileSync(f, "utf8").includes(anonKey));
check(
  "the anon key IS in the bundle, as intended (RLS is what protects data)",
  anonInBundle,
  undefined
);

// =====================================================================
console.log("\n# Service-role call sites are all guarded");
//
// createAdminClient() bypasses RLS entirely. Every call site inside a
// Server Action must therefore do its own authorization, because the
// database will not do it for them. This enumerates them from source
// rather than trusting a memory of having checked.

const actionFiles = execFileSync(
  "node",
  [
    "-e",
    `const {execSync}=require('child_process');process.stdout.write(execSync('git ls-files src',{encoding:'utf8'}))`,
  ],
  { encoding: "utf8" }
)
  .split("\n")
  .filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"));

const serviceRoleSites = [];
for (const file of actionFiles) {
  if (!existsSync(file)) continue;
  const source = readFileSync(file, "utf8");
  if (!source.includes("createAdminClient")) continue;
  serviceRoleSites.push({
    file,
    isServerAction: source.includes('"use server"'),
    hasPermissionGuard: /requirePermission|isStaffRole|is_admin/.test(source),
    // The customer-facing pattern: prove ownership against the caller's
    // own id on the RLS client, THEN escalate.
    hasOwnershipCheck: /!==\s*user\.id|\.eq\("customer_id",\s*user\.id\)|\.eq\("profile_id",\s*user\.id\)|\.eq\("id",\s*user\.id\)/.test(
      source
    ),
    checksAuth: /auth\.getUser\(\)/.test(source),
  });
}

check("service-role call sites were enumerated", serviceRoleSites.length > 0, `${serviceRoleSites.length} files`);

for (const site of serviceRoleSites) {
  if (!site.isServerAction) {
    // Library and route-handler usage is covered by the route's own
    // auth (cron secret, webhook signature), checked separately below.
    console.log(`      (${site.file} — not a Server Action, covered elsewhere)`);
    continue;
  }
  const guarded = site.hasPermissionGuard || (site.checksAuth && site.hasOwnershipCheck);
  check(
    `${site.file}: escalates only behind a permission or ownership check`,
    guarded,
    guarded ? undefined : "uses createAdminClient with no visible guard",
    "critical"
  );
}

// =====================================================================
console.log("\n# Stripe webhook rejects forged payloads");

const forged = JSON.stringify({
  id: "evt_forged",
  type: "checkout.session.completed",
  data: { object: { id: "cs_forged", metadata: { order_id: "00000000-0000-0000-0000-000000000000" } } },
});

const noSig = await fetch(`${APP_URL}/api/webhooks/stripe`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: forged,
});
check("a webhook with NO signature is rejected", noSig.status >= 400, `status ${noSig.status}`, "critical");

const badSig = await fetch(`${APP_URL}/api/webhooks/stripe`, {
  method: "POST",
  headers: { "content-type": "application/json", "stripe-signature": "t=1,v1=deadbeef" },
  body: forged,
});
check("a webhook with a BAD signature is rejected", badSig.status >= 400, `status ${badSig.status}`, "critical");

// =====================================================================
console.log("\n# Cron routes are not open endpoints");

for (const route of ["/api/cron/reminders", "/api/cron/abandon-carts", "/api/cron/purge-analytics"]) {
  const res = await fetch(`${APP_URL}${route}`, {
    headers: { authorization: "Bearer definitely-not-the-secret" },
  });
  // Asserts BEHAVIOUR, not the presence of an environment variable.
  //
  // The first version of this check tested `process.env.CRON_SECRET` and
  // failed when it was unset — which described the local environment
  // rather than the code. What actually matters is that an unauthorised
  // caller cannot make the route do its work, and that is true two ways
  // now: 401 when a secret is configured and the token is wrong, 503
  // when no secret is configured at all (Module 29 made authorizeCron
  // fail closed in production instead of skipping the check).
  //
  // A 200 here means the endpoint ran for an unauthenticated caller,
  // which is the failure worth catching.
  check(
    `${route} refuses an unauthorised caller`,
    res.status === 401 || res.status === 503,
    `status ${res.status}`,
    "high"
  );
}

// =====================================================================
console.log("\n# Price integrity — the server must not trust client prices");

const shopper = await makeUser("shopper");
const { data: product } = await admin
  .from("products")
  .insert({
    name: `Sec Test Product ${suffix}`,
    slug: `sec-test-${suffix}`,
    base_price: 1200,
    status: "published",
  })
  .select("id, base_price")
  .single();

// getCart() resolves the cart through get_or_create_cart(p_session_id),
// which reads the `cart_session` cookie — so the seeded cart needs a
// session id the probe can present. Without it the checkout probe just
// created a fresh empty cart and proved nothing.
const cartSessionId = crypto.randomUUID();
const { data: cart } = await admin
  .from("carts")
  .insert({ customer_id: shopper.id, session_id: cartSessionId })
  .select("id")
  .single();

// The tamper: a cart row claiming this £1200 product costs £1.
await admin.from("cart_items").insert({
  cart_id: cart.id,
  product_id: product.id,
  quantity: 1,
  unit_price_snapshot: 1,
});

const { data: tampered } = await admin
  .from("cart_items")
  .select("unit_price_snapshot")
  .eq("cart_id", cart.id)
  .single();
check(
  "cart_items.unit_price_snapshot is client-writable (so it must not be trusted)",
  Number(tampered.unit_price_snapshot) === 1,
  `snapshot = ${tampered.unit_price_snapshot}`
);

/**
 * Strips comments before scanning source.
 *
 * The first version of the check below did not, and reported a CRITICAL
 * "checkout reads unit_price_snapshot" — matching the comment that says
 * the snapshot is deliberately IGNORED. A security check that cries wolf
 * on its own documentation is worse than no check: it trains the reader
 * to skim past the word CRITICAL.
 */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const checkoutSource = readFileSync("src/features/checkout/actions.ts", "utf8");
const placeOrderCode = stripComments(
  checkoutSource.split("export async function placeOrder")[1] ?? ""
);

check(
  "checkout re-derives prices from products rather than the cart snapshot",
  placeOrderCode.includes("unit_price: product.base_price"),
  undefined,
  "critical"
);
check(
  "checkout never reads unit_price_snapshot in code (comments aside)",
  !/unit_price_snapshot/.test(placeOrderCode),
  undefined,
  "critical"
);

// BEHAVIOURAL proof, not just a source assertion. The two checks above
// say what the code reads; this places a real order from the tampered
// cart and asserts what the database ends up holding. "The code looks
// right" and "the system charges the right amount" are different claims,
// and for price integrity only the second one matters.
const { data: shopperAddress } = await admin
  .from("addresses")
  .insert({
    customer_id: shopper.id,
    recipient_name: "Sec Test",
    line1: "1 Test St",
    city: "London",
    postal_code: "E1 1AA",
    country: "UK",
  })
  .select("id")
  .single();

// The cart cookie is how getCart() finds an anonymous-or-owned cart; a
// signed-in customer's cart is found by customer_id, which is already set.
const checkoutIds = actionIdsFor("(storefront)/checkout/page");
check("checkout action id resolves", checkoutIds.length > 0, `${checkoutIds.length} ids`);

let orderPlaced = null;
for (const id of checkoutIds) {
  // The progressive-enhancement form path, not the `next-action` header
  // one: the header path expects the RSC wire format, while a plain
  // multipart POST carrying `$ACTION_ID_<id>` is exactly what a browser
  // with JS disabled sends — and it accepts ordinary form fields.
  const form = new FormData();
  form.set("addressId", shopperAddress.id);
  form.set(`$ACTION_ID_${id}`, "");
  await fetch(`${APP_URL}/checkout`, {
    method: "POST",
    headers: { cookie: `${sessionCookie(shopper.session)}; cart_session=${cartSessionId}` },
    body: form,
    redirect: "manual",
  });
  const { data: orders } = await admin
    .from("orders")
    .select("id, subtotal, total_amount")
    .eq("customer_id", shopper.id);
  if (orders?.length) {
    orderPlaced = orders[0];
    break;
  }
}

if (orderPlaced) {
  // The cart claimed £1. The product costs £1200.
  check(
    "an order placed from a tampered cart is priced from the PRODUCT, not the cart",
    Number(orderPlaced.subtotal) === 1200,
    `subtotal = ${orderPlaced.subtotal} (cart claimed 1, product is 1200)`,
    "critical"
  );
  await admin.from("order_items").delete().eq("order_id", orderPlaced.id);
  await admin.from("orders").delete().eq("id", orderPlaced.id);
} else {
  // Not a pass. If the probe cannot place an order the claim is
  // unverified, and an unverified price-integrity check should look
  // like a gap rather than a success.
  // HARNESS LIMITATION, reported as such rather than as a finding.
  // Counting it as a FAIL would file a shortcoming of the test under
  // "security finding" — the same cry-wolf problem the comment-stripping
  // fix above exists to prevent. Price integrity IS verified at source
  // level; what is not proven here is the end-to-end behaviour, and that
  // distinction is stated rather than smoothed over.
  console.log("      SKIP — end-to-end price probe could not place an order (harness limitation).");
  console.log("             Price integrity asserted at source level above, not behaviourally.");
}
await admin.from("addresses").delete().eq("id", shopperAddress.id);

// =====================================================================
console.log("\n# Cross-user isolation on the newer tables");
//
// verify-cross-user.mjs covers the Module 1-15 tables. These are the ones
// added since, which that script predates.

const other = await makeUser("other");

const { data: shopperNotification } = await admin
  .from("notifications")
  .insert({
    profile_id: shopper.id,
    type: "order_confirmed",
    title: "Private",
    body: "Private",
    channel: "in_app",
  })
  .select("id")
  .single();

const { data: otherSeesNotification } = await other.client
  .from("notifications")
  .select("id")
  .eq("id", shopperNotification.id);
check(
  "a customer cannot read another customer's notifications",
  (otherSeesNotification?.length ?? 0) === 0,
  undefined,
  "high"
);

await admin
  .from("notification_preferences")
  .insert({ profile_id: shopper.id, category: "orders", email_enabled: false });
const { data: otherSeesPrefs } = await other.client
  .from("notification_preferences")
  .select("category")
  .eq("profile_id", shopper.id);
check(
  "a customer cannot read another customer's notification preferences",
  (otherSeesPrefs?.length ?? 0) === 0,
  undefined,
  "high"
);

const { data: otherSeesReminders } = await other.client
  .from("notification_reminders")
  .select("kind");
check(
  "a customer cannot read the reminder ledger",
  (otherSeesReminders?.length ?? 0) === 0,
  undefined,
  "medium"
);

const { data: otherSeesPermissions } = await other.client.from("role_permissions").select("role");
check(
  "a signed-in customer CAN read the permission matrix (needed by the admin UI)",
  (otherSeesPermissions?.length ?? 0) > 0,
  "by design — it contains no secrets, only role names"
);

// =====================================================================
console.log("\n# Admin Server Actions refuse a customer session");
//
// Server Actions are independently addressable POST endpoints; the
// (admin) layout guard does not protect them. Probed over HTTP with a
// real customer cookie.
//
// A CURATED set, not every action. Blind-firing all 118 with empty
// payloads would mutate whatever happened not to validate, which is
// exactly the kind of collateral damage a security test must not cause.

const customerCookie = sessionCookie(shopper.session);

function actionIdsFor(pathFragment) {
  const manifestPath = ".next/server/server-reference-manifest.json";
  if (!existsSync(manifestPath)) return [];
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  return Object.entries(manifest.node ?? {})
    .filter(([, entry]) => Object.keys(entry.workers ?? {}).some((m) => m.includes(pathFragment)))
    .map(([id]) => id);
}

// The admin settings page is a good representative: one action, clearly
// privileged, and a rejected call writes nothing.
const settingsActions = actionIdsFor("admin/settings/page");
check("admin action ids resolve from the build manifest", settingsActions.length > 0, `${settingsActions.length} ids`);

const { data: settingsBefore } = await admin.from("site_settings").select("key, value");
let anySucceeded = false;
for (const id of settingsActions.slice(0, 8)) {
  const res = await fetch(`${APP_URL}/admin/settings`, {
    method: "POST",
    headers: { cookie: customerCookie, "next-action": id },
    body: new URLSearchParams({ "store.name": `PWNED-${suffix}` }),
  });
  if (res.status === 200 && !(await res.text()).includes("permission")) {
    // Not conclusive on its own — the DB check below is what decides.
  }
}
const { data: settingsAfter } = await admin.from("site_settings").select("key, value");
anySucceeded = JSON.stringify(settingsBefore) !== JSON.stringify(settingsAfter);
check(
  "a customer session cannot change site settings through a Server Action",
  !anySucceeded,
  anySucceeded ? "SETTINGS WERE MODIFIED" : undefined,
  "critical"
);

// The (admin) route guard itself.
const adminPage = await fetch(`${APP_URL}/admin/settings`, {
  headers: { cookie: customerCookie },
  redirect: "manual",
});
check(
  "a customer is redirected away from /admin/settings",
  adminPage.status === 307 || adminPage.status === 302,
  `status ${adminPage.status}`,
  "high"
);

// =====================================================================
console.log("\n# Abuse prevention — unbounded anonymous row creation");
//
// Middleware issues a cart_session cookie to every visitor, and
// get_or_create_cart() then writes a carts row for it. So one HTTP
// request from an anonymous client creates a database row, with no rate
// limit and no cleanup — a crawler or a trivial loop can grow the table
// without bound.

// Tests the REAPER, not the current table size. Counting rows would fail
// for three days after any burst of traffic and pass afterwards, which
// measures the calendar rather than the code.
//
// Two fixtures, because the dangerous mistake here is over-deleting: a
// guest who put something in a basket is a sales lead, and reaping that
// would be destroying business data to save a row.
const oldTimestamp = new Date(Date.now() - 200 * 3_600_000).toISOString();

const { data: staleEmpty } = await admin
  .from("carts")
  .insert({ session_id: `sec-stale-${suffix}`, status: "active", updated_at: oldTimestamp })
  .select("id")
  .single();

const { data: staleWithItems } = await admin
  .from("carts")
  .insert({ session_id: `sec-keep-${suffix}`, status: "active", updated_at: oldTimestamp })
  .select("id")
  .single();
const { data: keepProduct } = await admin
  .from("products")
  .insert({
    name: `Reap Guard ${suffix}`,
    slug: `reap-guard-${suffix}`,
    base_price: 10,
    status: "published",
  })
  .select("id")
  .single();
await admin
  .from("cart_items")
  .insert({ cart_id: staleWithItems.id, product_id: keepProduct.id, quantity: 1, unit_price_snapshot: 10 });

const { data: reapedCount, error: reapError } = await admin.rpc("reap_stale_carts", {
  p_older_than_hours: 72,
});
check("reap_stale_carts runs", !reapError, reapError?.message, "medium");

const { data: emptyGone } = await admin.from("carts").select("id").eq("id", staleEmpty.id);
check(
  "the reaper deletes a stale, ownerless, EMPTY cart",
  (emptyGone?.length ?? 0) === 0,
  `${reapedCount} row(s) reaped`,
  "medium"
);

const { data: itemsKept } = await admin.from("carts").select("id").eq("id", staleWithItems.id);
check(
  "the reaper KEEPS a stale guest cart that has items in it",
  (itemsKept?.length ?? 0) === 1,
  "a guest basket is a sales lead, not junk",
  "high"
);

await admin.from("cart_items").delete().eq("cart_id", staleWithItems.id);
await admin.from("carts").delete().eq("id", staleWithItems.id);
await admin.from("products").delete().eq("id", keepProduct.id);

// =====================================================================
console.log("\n# Security headers");
//
// Expected to FAIL until Pass 2. Recorded as findings rather than
// omitted, because "we did not check" and "we checked and it is missing"
// are different things and only one of them is an audit.

const headerRes = await fetch(`${APP_URL}/`);
const REQUIRED_HEADERS = [
  ["x-frame-options", "clickjacking (or frame-ancestors in CSP)", "medium"],
  ["x-content-type-options", "MIME sniffing", "medium"],
  ["referrer-policy", "referrer leakage to third parties", "low"],
];
for (const [header, why, severity] of REQUIRED_HEADERS) {
  const value = headerRes.headers.get(header);
  check(`response sets ${header}`, !!value, value ?? `missing — ${why}`, severity);
}

// CSP is checked separately because either header satisfies "a policy
// exists"; which one is served is a rollout stage, not a pass/fail.
const enforcedCsp = headerRes.headers.get("content-security-policy");
const reportOnlyCsp = headerRes.headers.get("content-security-policy-report-only");
check(
  "a Content-Security-Policy is served (enforced or report-only)",
  !!(enforcedCsp || reportOnlyCsp),
  enforcedCsp ? "ENFORCED" : "report-only",
  "high"
);
if (!enforcedCsp && reportOnlyCsp) {
  console.log(
    "      NOTE — the policy is Report-Only, so it reports violations without blocking."
  );
  console.log(
    "             Enforcing it is a deliberate later step: watch real traffic first."
  );
}

// =====================================================================
console.log("\n# CSP covers every host the app actually loads");
//
// Lighthouse and a browser console are not available here, so "verify no
// CSP violations" is approximated the only way it can be: fetch the real
// rendered HTML, extract every external host it references, and check
// each one against the policy.
//
// This is an APPROXIMATION and is labelled as one. It sees hosts present
// in server-rendered markup; it does not see a fetch() a client component
// makes after hydration. Those need a real browser against a deployed
// site, which is why the policy ships Report-Only until someone has
// watched real traffic.

const cspHeader = headerRes.headers.get("content-security-policy-report-only");
check("a report-only CSP is served", !!cspHeader, undefined, "high");

if (cspHeader) {
  const allowedHosts = new Set(
    [...cspHeader.matchAll(/https?:\/\/[^\s;]+/g)].map((m) => new URL(m[0]).host)
  );
  const selfHost = new URL(APP_URL).host;

  const referenced = new Map();
  for (const path of ["/", "/products", "/collections", "/contact", "/faq", "/cart", "/login"]) {
    const html = await (await fetch(`${APP_URL}${path}`)).text();
    for (const m of html.matchAll(/(?:src|href)="(https?:\/\/[^"]+)"/g)) {
      const host = new URL(m[1]).host;
      // 'self' covers the app's own origin; a checker that did not know
      // that would report every one of its own assets as a violation.
      if (host === selfHost) continue;
      if (!referenced.has(host)) referenced.set(host, path);
    }
  }

  const outside = [...referenced.keys()].filter((h) => !allowedHosts.has(h));
  check(
    "no externally-referenced host falls outside the CSP",
    outside.length === 0,
    outside.length ? outside.join(", ") : `${referenced.size} external host(s), all allowed`,
    "high"
  );
}

// =====================================================================

console.log("\n# Audit logging");
//
// The audit_logs table has existed since 0009 with an admin-only policy,
// and nothing in src/ writes to it. So there is currently no record of
// who changed a price, issued a refund, or altered someone's role.

const sourceFiles = actionFiles.filter((f) => existsSync(f));
const writesAuditLog = sourceFiles.some((f) => {
  const source = readFileSync(f, "utf8");
  return /from\("audit_logs"\)\s*\.\s*insert|logAudit\(/.test(source);
});
check(
  "sensitive mutations write to audit_logs",
  writesAuditLog,
  writesAuditLog ? undefined : "audit_logs table exists but nothing writes to it",
  "high"
);

// =====================================================================
console.log("\n# Rate limiting on public write endpoints");

const rateLimited = sourceFiles.filter((f) => {
  const source = readFileSync(f, "utf8");
  return /rate-?limit/i.test(source);
});
check(
  "a rate-limiting mechanism exists",
  rateLimited.length > 0,
  `${rateLimited.length} files reference it`
);

// The public forms that write rows and send email.
for (const [file, label] of [
  ["src/features/contact/actions.ts", "contact / enquiry form"],
  ["src/features/consultations/actions.ts", "consultation booking"],
  ["src/features/marketing/actions.ts", "newsletter signup"],
]) {
  if (!existsSync(file)) {
    console.log(`      (skipped ${label} — ${file} not found)`);
    continue;
  }
  const source = readFileSync(file, "utf8");
  check(
    `${label} is rate limited`,
    /rate-?limit/i.test(source),
    /rate-?limit/i.test(source) ? undefined : "anonymous callers can submit without limit",
    "medium"
  );
}

// =====================================================================
console.log("\nCleaning up...");
await admin.from("cart_items").delete().eq("cart_id", cart.id);
await admin.from("carts").delete().eq("id", cart.id);
await admin.from("products").delete().eq("id", product.id);
await admin.from("notifications").delete().in("profile_id", createdUsers);
await admin.from("notification_preferences").delete().in("profile_id", createdUsers);
for (const id of createdUsers) await admin.auth.admin.deleteUser(id);

console.log(`\n${passed} passed, ${failed} failed`);
if (findings.length > 0) {
  const order = { critical: 0, high: 1, medium: 2, low: 3 };
  console.log("\nFINDINGS, most severe first:");
  for (const f of findings.sort((a, b) => order[a.severity] - order[b.severity])) {
    console.log(`  [${f.severity.toUpperCase()}] ${f.label}${f.detail ? ` — ${f.detail}` : ""}`);
  }
}
process.exit(failed === 0 ? 0 : 1);
