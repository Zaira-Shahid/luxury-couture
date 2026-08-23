// Module 26 — the role x capability matrix, driven through REAL signed-in
// sessions against RLS rather than through the UI.
//
// The negative half is the point. A permission system that grants
// correctly but revokes nothing is worse than none at all, because it
// reads as protection. So for every "this role can", there is a "this
// role cannot".
//
// Pass 1 scope: the permission primitives themselves — has_permission()
// per role, the deliberate narrowing of role assignment to super_admin,
// the 0017/0018 self-promotion guard, fail-closed behaviour, and an
// anti-regression check that a plain `admin` still reaches a
// representative table in every domain. The per-domain policies that let
// sales/finance/production do their own jobs arrive in Pass 2, and their
// checks are added here then.
//
//   node --env-file=.env.local scripts/test-permissions.mjs
import { createClient } from "@supabase/supabase-js";

import { purgeDevtestData } from "./lib/purge-devtest.mjs";

import {
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSIONS,
  roleHasPermission,
} from "../src/lib/auth/permissions.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

const admin = createClient(url, serviceKey, {
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

// Uses the admin API rather than the public signUp flow, matching
// verify-cross-user.mjs: this verifies RLS, not email delivery.
async function actor(role) {
  const email = `perm-${role}-${suffix}@luxury-couture-devtest.local`;
  const password = `perm-test-${role}-${suffix}`;
  const { data: user, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr) throw new Error(`createUser(${role}) failed: ${createErr.message}`);

  // The role is set with the service-role client on purpose: the trigger
  // exempts service_role/postgres, which is exactly how a seed or a
  // migration is meant to assign roles. The guard against ordinary
  // callers doing it is tested separately below.
  if (role !== "customer") {
    const { error: roleErr } = await admin.from("profiles").update({ role }).eq("id", user.user.id);
    if (roleErr) throw new Error(`role assign(${role}) failed: ${roleErr.message}`);
  }

  const client = createClient(url, anonKey);
  const { error: signInErr } = await client.auth.signInWithPassword({ email, password });
  if (signInErr) throw new Error(`signIn(${role}) failed: ${signInErr.message}`);

  created.push(user.user.id);
  return { client, id: user.user.id, role, email };
}

const roles = [
  "customer",
  "super_admin",
  "admin",
  "sales",
  "production",
  "qc",
  "finance",
  "support",
  "marketing",
];
// Idempotent setup — see scripts/lib/purge-devtest.mjs. This script
// creates nine accounts per run; a crash used to leave all nine behind.
const purged = await purgeDevtestData(admin);
if (purged > 0) console.log(`(purged ${purged} leaked dev-test account(s) from a previous run)`);

const actors = {};
for (const role of roles) actors[role] = await actor(role);

// Give handle_new_user and the role updates a moment to settle.
await new Promise((r) => setTimeout(r, 500));

async function can(who, permission) {
  const { data, error } = await who.client.rpc("has_permission", { p_key: permission });
  if (error) throw new Error(`has_permission(${permission}) as ${who.role}: ${error.message}`);
  return data === true;
}

// ---------------------------------------------------------------------
console.log("\n# has_permission() agrees with the seeded matrix, for every role x permission");

// 9 roles x 23 permissions, asserted in both directions — a granted
// permission must be true and an ungranted one must be false. Rolled up
// per role so the output stays readable; a mismatch names the exact key.
for (const role of roles) {
  const mismatches = [];
  for (const permission of PERMISSIONS) {
    const actual = await can(actors[role], permission);
    const expected = roleHasPermission(role, permission);
    if (actual !== expected) mismatches.push(`${permission} (db=${actual}, expected=${expected})`);
  }
  check(
    `${role}: all ${PERMISSIONS.length} permissions match the code mirror${
      mismatches.length ? ` — ${mismatches.join(", ")}` : ""
    }`,
    mismatches.length === 0
  );
}

// ---------------------------------------------------------------------
console.log("\n# The negative half — no role reaches into another's domain");

check("sales cannot read payments", !(await can(actors.sales, "payments.read")));
check("sales cannot refund", !(await can(actors.sales, "payments.refund")));
check("support cannot change production", !(await can(actors.support, "production.write")));
check("support cannot write orders", !(await can(actors.support, "orders.write")));
check("marketing cannot read orders", !(await can(actors.marketing, "orders.read")));
check("marketing cannot read payments", !(await can(actors.marketing, "payments.read")));
check("finance cannot publish content", !(await can(actors.finance, "content.write")));
check("finance cannot write orders", !(await can(actors.finance, "orders.write")));
check("production cannot read payments", !(await can(actors.production, "payments.read")));
check("qc cannot write production", !(await can(actors.qc, "production.write")));
check("qc cannot write orders", !(await can(actors.qc, "orders.write")));
check("customer holds no permission at all", !(await can(actors.customer, "orders.read")));
check("customer cannot manage settings", !(await can(actors.customer, "settings.manage")));

// ---------------------------------------------------------------------
console.log("\n# Each role CAN do its own job");

check("sales reads orders", await can(actors.sales, "orders.read"));
check("sales writes quotations", await can(actors.sales, "quotations.write"));
check("finance reads payments", await can(actors.finance, "payments.read"));
check("finance can refund", await can(actors.finance, "payments.refund"));
check("production writes production", await can(actors.production, "production.write"));
check("production writes shipping", await can(actors.production, "shipping.write"));
check("qc records QC outcomes", await can(actors.qc, "qc.write"));
check("support writes enquiries", await can(actors.support, "enquiries.write"));
check("marketing writes campaigns", await can(actors.marketing, "marketing.write"));
check("marketing moderates reviews", await can(actors.marketing, "reviews.moderate"));

// ---------------------------------------------------------------------
console.log("\n# roles.manage — the deliberate narrowing");

check("super_admin can manage roles", await can(actors.super_admin, "roles.manage"));
check("admin CANNOT manage roles (narrowed in 0053)", !(await can(actors.admin, "roles.manage")));
for (const role of ["sales", "production", "qc", "finance", "support", "marketing"]) {
  check(`${role} cannot manage roles`, !(await can(actors[role], "roles.manage")));
}

// super_admin holds everything implicitly rather than by seeded rows, so
// a permission added by a later module cannot lock out the one role that
// must never be locked out. Assert that property directly.
const { data: superRows } = await admin
  .from("role_permissions")
  .select("permission_key")
  .eq("role", "super_admin");
check(
  "super_admin holds every permission implicitly, not by stored rows",
  (superRows?.length ?? 0) === 0 &&
    (await Promise.all(PERMISSIONS.map((p) => can(actors.super_admin, p)))).every(Boolean)
);

// ---------------------------------------------------------------------
console.log("\n# Role assignment through RLS and the 0017/0018 trigger");

const { error: selfPromoteErr } = await actors.customer.client
  .from("profiles")
  .update({ role: "admin" })
  .eq("id", actors.customer.id);
check("a customer cannot self-promote to admin", !!selfPromoteErr);

const { error: salesPromoteErr } = await actors.sales.client
  .from("profiles")
  .update({ role: "super_admin" })
  .eq("id", actors.sales.id);
check("a sales user cannot self-promote to super_admin", !!salesPromoteErr);

// The narrowing, exercised for real rather than only through
// has_permission(): a plain admin attempting to change someone else's
// role must be refused by the trigger.
const { error: adminAssignErr } = await actors.admin.client
  .from("profiles")
  .update({ role: "finance" })
  .eq("id", actors.support.id);
const { data: supportAfterAdmin } = await admin
  .from("profiles")
  .select("role")
  .eq("id", actors.support.id)
  .single();
check(
  "a plain admin cannot change another user's role",
  !!adminAssignErr || supportAfterAdmin?.role === "support"
);

const { error: superAssignErr } = await actors.super_admin.client
  .from("profiles")
  .update({ role: "finance" })
  .eq("id", actors.support.id);
const { data: supportAfterSuper } = await admin
  .from("profiles")
  .select("role")
  .eq("id", actors.support.id)
  .single();
check(
  "a super_admin CAN change another user's role",
  !superAssignErr && supportAfterSuper?.role === "finance"
);
// Restore, so the checks below still describe a support account.
await admin.from("profiles").update({ role: "support" }).eq("id", actors.support.id);

// ---------------------------------------------------------------------
console.log("\n# The permission matrix itself is protected");

const { error: salesEditErr } = await actors.sales.client
  .from("role_permissions")
  .insert({ role: "sales", permission_key: "payments.refund" });
check("sales cannot grant itself a permission", !!salesEditErr);

const { error: adminEditErr } = await actors.admin.client
  .from("role_permissions")
  .insert({ role: "admin", permission_key: "roles.manage" });
check("a plain admin cannot grant itself roles.manage", !!adminEditErr);

const { data: matrixReadable } = await actors.sales.client
  .from("role_permissions")
  .select("role")
  .limit(1);
check("staff can READ the matrix (the admin UI needs it)", (matrixReadable?.length ?? 0) === 1);

const anon = createClient(url, anonKey);
const { data: anonMatrix } = await anon.from("role_permissions").select("role").limit(1);
check("a signed-out visitor cannot read the matrix", (anonMatrix?.length ?? 0) === 0);

// ---------------------------------------------------------------------
console.log("\n# Fail-closed");

// A role with no rows at all must get nothing rather than everything.
// 'staff' is seeded, so use a name that is deliberately absent from the
// matrix; the constraint keeps it off profiles, so this asks the
// function directly through a real session whose role has no rows.
await admin.from("role_permissions").delete().eq("role", "qc");
const qcAfterWipe = await Promise.all(PERMISSIONS.map((p) => can(actors.qc, p)));
check(
  "a role whose permission rows are all removed holds nothing",
  qcAfterWipe.every((granted) => granted === false)
);
// Put the seed back.
await admin
  .from("role_permissions")
  .insert(DEFAULT_ROLE_PERMISSIONS.qc.map((permission_key) => ({ role: "qc", permission_key })));
const qcRestored = await can(actors.qc, "qc.write");
check("restoring the seed restores the permission", qcRestored);

// ---------------------------------------------------------------------
console.log("\n# Anti-regression — a plain admin still reaches every domain");

// The direct answer to the risk this module carries: 151 existing
// policies call is_admin(), which 0053 widened rather than replaced. If
// any of them had been disturbed, these reads would fail.
for (const table of [
  "orders",
  "quotations",
  "payments",
  "products",
  "enquiries",
  "production_orders",
  "reviews",
  "site_settings",
  "profiles",
]) {
  const { error } = await actors.admin.client.from(table).select("*").limit(1);
  check(`admin can still read ${table}`, !error);
}

// And super_admin, the role every existing admin was promoted to, must
// reach exactly the same places.
for (const table of ["orders", "payments", "products", "site_settings"]) {
  const { error } = await actors.super_admin.client.from(table).select("*").limit(1);
  check(`super_admin can read ${table} (is_admin widened, not replaced)`, !error);
}

// ---------------------------------------------------------------------
console.log("\n# Pass 2 — real table access through RLS, not through has_permission()");

// Everything above asks the permission function what it thinks. This
// section asks the database what it actually allows, which is the only
// answer that matters. Seeded with the service-role client so the setup
// itself is never the thing under test.
// Reuses the customer actor from above rather than creating another.
const shopper = actors.customer;
const { data: seedAddress } = await admin
  .from("addresses")
  .insert({
    customer_id: shopper.id,
    recipient_name: "Perm Test",
    line1: "1 Test St",
    city: "London",
    postal_code: "E1 1AA",
    country: "UK",
  })
  .select()
  .single();
const { data: seedOrder } = await admin
  .from("orders")
  .insert({
    customer_id: shopper.id,
    shipping_address_id: seedAddress.id,
    status: "pending",
    subtotal: 500,
    total_amount: 500,
    balance_due_amount: 500,
  })
  .select("id")
  .single();
const { data: seedPayment } = await admin
  .from("payments")
  .insert({ order_id: seedOrder.id, type: "deposit", amount: 100, status: "succeeded" })
  .select("id")
  .single();
const { data: seedProduction } = await admin
  .from("production_orders")
  .insert({ order_id: seedOrder.id, current_status: "cutting" })
  .select("id")
  .single();
const { data: seedEnquiry } = await admin
  .from("enquiries")
  .insert({
    type: "general",
    contact_name: "Perm Test",
    contact_email: "perm-" + suffix + "@luxury-couture-devtest.local",
    message: "Permission matrix test",
    status: "new",
  })
  .select("id")
  .single();

// A read that RLS refuses returns zero rows rather than an error, so
// every read assertion is on the ROW COUNT, never on `error`.
async function reads(who, table, id) {
  const { data } = await who.client.from(table).select("id").eq("id", id);
  return (data?.length ?? 0) === 1;
}

// An update RLS refuses is also silent — the statement matches no rows.
// `.select()` is what makes the difference visible.
async function updates(who, table, id, patch) {
  const { data, error } = await who.client.from(table).update(patch).eq("id", id).select("id");
  return !error && (data?.length ?? 0) === 1;
}

console.log("\n## Each role can reach its own domain");
check("sales reads the order", await reads(actors.sales, "orders", seedOrder.id));
check("sales updates the order", await updates(actors.sales, "orders", seedOrder.id, { status: "confirmed" }));
check("sales reads the enquiry", await reads(actors.sales, "enquiries", seedEnquiry.id));
check("finance reads the payment", await reads(actors.finance, "payments", seedPayment.id));
check("finance reads the order", await reads(actors.finance, "orders", seedOrder.id));
check("production reads the production order", await reads(actors.production, "production_orders", seedProduction.id));
check(
  "production advances the production order",
  await updates(actors.production, "production_orders", seedProduction.id, { current_status: "stitching" })
);
check("support reads the enquiry", await reads(actors.support, "enquiries", seedEnquiry.id));
check(
  "support updates the enquiry",
  await updates(actors.support, "enquiries", seedEnquiry.id, { status: "in_review" })
);
check("qc reads the production order", await reads(actors.qc, "production_orders", seedProduction.id));

const { data: qcEntry, error: qcErr } = await actors.qc.client
  .from("production_status_history")
  .insert({ production_order_id: seedProduction.id, status: "quality_check", note: "QC pass" })
  .select("id");
check("qc records a status-history entry", !qcErr && (qcEntry?.length ?? 0) === 1);

const { data: campaign, error: campaignErr } = await actors.marketing.client
  .from("campaigns")
  .insert({ subject: "Perm test", body: "Body", target: "all_subscribers", status: "draft" })
  .select("id");
check("marketing creates a campaign", !campaignErr && (campaign?.length ?? 0) === 1);
if (campaign?.[0]) await admin.from("campaigns").delete().eq("id", campaign[0].id);

console.log("\n## And CANNOT reach anyone else's");
check("sales cannot read the payment", !(await reads(actors.sales, "payments", seedPayment.id)));
check(
  "sales cannot advance production",
  !(await updates(actors.sales, "production_orders", seedProduction.id, { current_status: "finishing" }))
);
check("marketing cannot read the order", !(await reads(actors.marketing, "orders", seedOrder.id)));
check("marketing cannot read the payment", !(await reads(actors.marketing, "payments", seedPayment.id)));
check("finance cannot update the order", !(await updates(actors.finance, "orders", seedOrder.id, { status: "cancelled" })));
check("production cannot read the payment", !(await reads(actors.production, "payments", seedPayment.id)));
check(
  "support cannot advance production",
  !(await updates(actors.support, "production_orders", seedProduction.id, { current_status: "finishing" }))
);
check(
  "qc cannot advance production directly",
  !(await updates(actors.qc, "production_orders", seedProduction.id, { current_status: "finishing" }))
);

const { data: financePage, error: financePageErr } = await actors.finance.client
  .from("pages")
  .insert({ slug: "perm-test-" + suffix, title: "Perm", content: "x", status: "draft" })
  .select("id");
check("finance cannot publish content", !!financePageErr || (financePage?.length ?? 0) === 0);
if (financePage?.[0]) await admin.from("pages").delete().eq("id", financePage[0].id);

const { data: salesCampaign, error: salesCampaignErr } = await actors.sales.client
  .from("campaigns")
  .insert({ subject: "No", body: "No", target: "all_subscribers", status: "draft" })
  .select("id");
check("sales cannot create a campaign", !!salesCampaignErr || (salesCampaign?.length ?? 0) === 0);
if (salesCampaign?.[0]) await admin.from("campaigns").delete().eq("id", salesCampaign[0].id);

const { data: marketingSettings, error: marketingSettingsErr } = await actors.marketing.client
  .from("site_settings")
  .upsert({ key: "store.name", value: "hijacked" })
  .select("key");
check(
  "marketing cannot write site settings",
  !!marketingSettingsErr || (marketingSettings?.length ?? 0) === 0
);

// audit_logs is deliberately left admin-only: a log the people it records
// can read on the strength of a domain permission is worth less.
const { data: salesAudit } = await actors.sales.client.from("audit_logs").select("id").limit(1);
check("no domain permission opens audit_logs", (salesAudit?.length ?? 0) === 0);

// profiles is granted SELECT only, so customers.read never becomes a
// write path into the role column.
const { error: supportProfileErr } = await actors.support.client
  .from("profiles")
  .update({ full_name: "Hijacked" })
  .eq("id", shopper.id);
const { data: shopperAfter } = await admin
  .from("profiles")
  .select("full_name")
  .eq("id", shopper.id)
  .single();
check(
  "customers.read does not grant profile writes",
  !!supportProfileErr || shopperAfter?.full_name !== "Hijacked"
);
check("support CAN read the customer profile", await reads(actors.support, "profiles", shopper.id));
check("production cannot read customer profiles", !(await reads(actors.production, "profiles", shopper.id)));

// Module 13's boundary, re-asserted from this module's side.
//
// 0054 originally gave `production` a blanket orders.read, which quietly
// undid 0034's rule that production staff see only orders handed to
// production — "not the full order book, not orders still in
// sales/negotiation". test-production.mjs caught it and 0055 removed the
// permission. These checks exist so it cannot come back through a change
// to the permission matrix rather than to a policy.
const { data: unhandedOrder } = await admin
  .from("orders")
  .insert({
    customer_id: shopper.id,
    shipping_address_id: seedAddress.id,
    status: "pending",
    subtotal: 300,
    total_amount: 300,
    balance_due_amount: 300,
  })
  .select("id")
  .single();

check(
  "production reads a HANDED-OFF order (0034's grant survives)",
  await reads(actors.production, "orders", seedOrder.id)
);
check(
  "production CANNOT read an order never sent to production",
  !(await reads(actors.production, "orders", unhandedOrder.id))
);
check("qc cannot read the order book at all", !(await reads(actors.qc, "orders", seedOrder.id)));
check(
  "production can still read measurements (granted under production.read)",
  !(await actors.production.client.from("measurement_profiles").select("id").limit(1)).error
);

await admin.from("orders").delete().eq("id", unhandedOrder.id);

console.log("\n## The customer's own access is unchanged");
check("the shopper still reads their own order", await reads(shopper, "orders", seedOrder.id));
check(
  "the shopper still cannot change their own order",
  !(await updates(shopper, "orders", seedOrder.id, { status: "delivered" }))
);

// Clean up the seeded rows. Orders cascade to production/payments.
await admin.from("enquiries").delete().eq("id", seedEnquiry.id);
await admin.from("orders").delete().eq("id", seedOrder.id);
await admin.from("addresses").delete().eq("id", seedAddress.id);

// ---------------------------------------------------------------------
console.log("\n# The admin shell, over HTTP with real session cookies");

// Matches @supabase/ssr's cookie format, the same helper
// test-admin-dashboard.mjs uses: sb-<project-ref>-auth-token holding
// base64url(JSON.stringify(session)) behind a "base64-" prefix.
function sessionCookie(session) {
  const ref = new URL(url).hostname.split(".")[0];
  const encoded = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  return "sb-" + ref + "-auth-token=base64-" + encoded;
}

async function sessionFor(who) {
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data } = await client.auth.signInWithPassword({
    email: who.email,
    password: "perm-test-" + who.role + "-" + suffix,
  });
  return sessionCookie(data.session);
}

async function get(path, cookie) {
  const res = await fetch(APP_URL + path, { headers: { cookie }, redirect: "manual" });
  return { status: res.status, html: await res.text() };
}

const superCookie = await sessionFor(actors.super_admin);
const adminCookie = await sessionFor(actors.admin);
const salesCookie = await sessionFor(actors.sales);
const customerCookie = await sessionFor(actors.customer);

const superTeam = await get("/admin/team", superCookie);
check("super_admin gets 200 on /admin/team", superTeam.status === 200);
check(
  "super_admin sees the team screen",
  superTeam.html.includes("Grant access to an existing account")
);

// notFound()/redirect() during render returns HTTP 200 in Next 15 (a
// characteristic this project has hit before), so the assertion is on
// the CONTENT, not the status code.
const adminTeam = await get("/admin/team", adminCookie);
check(
  "a plain admin does NOT get the team screen (redirected to /admin)",
  !adminTeam.html.includes("Grant access to an existing account")
);
const salesTeam = await get("/admin/team", salesCookie);
check(
  "sales does NOT get the team screen",
  !salesTeam.html.includes("Grant access to an existing account")
);

// Middleware gates the shell itself for a customer, before any page runs.
const customerAdmin = await get("/admin", customerCookie);
check(
  "a customer is bounced out of /admin by middleware",
  customerAdmin.status === 307 || customerAdmin.status === 302
);

// Sidebar filtering. Cosmetic by design — asserted so the cosmetics stay
// truthful, never as evidence of enforcement.
const salesDash = await get("/admin", salesCookie);
check("sales reaches the admin shell", salesDash.status === 200);
check("sales sees Orders in the sidebar", salesDash.html.includes("Orders"));
check("sales does NOT see Team / Roles in the sidebar", !salesDash.html.includes("Team &amp; Roles"));
check("sales does NOT see Payments in the sidebar", !salesDash.html.includes("Payments"));
check("sales does NOT see Production in the sidebar", !salesDash.html.includes("Production"));

const superDash = await get("/admin", superCookie);
check("super_admin sees Team / Roles in the sidebar", superDash.html.includes("Team &amp; Roles"));
check("super_admin sees Payments in the sidebar", superDash.html.includes("Payments"));

const adminDash = await get("/admin", adminCookie);
check("a plain admin still sees Payments (no regression)", adminDash.html.includes("Payments"));
check(
  "a plain admin does NOT see Team / Roles (roles.manage narrowed)",
  !adminDash.html.includes("Team &amp; Roles")
);

// The per-route guard. A 307 to /admin is the refusal; a 200 is access.
// This is the layer that keeps a Sales account off /admin/payments rather
// than merely hiding the menu entry from them.
async function routeAllowed(cookie, path) {
  const res = await fetch(APP_URL + path, { headers: { cookie }, redirect: "manual" });
  if (res.status === 200) return true;
  const location = res.headers.get("location") ?? "";
  return !(res.status === 307 || res.status === 302) || !location.endsWith("/admin");
}

const financeCookie = await sessionFor(actors.finance);
const marketingCookie = await sessionFor(actors.marketing);

check("sales reaches /admin/orders", await routeAllowed(salesCookie, "/admin/orders"));
check("sales is refused /admin/payments", !(await routeAllowed(salesCookie, "/admin/payments")));
check("sales is refused /admin/production", !(await routeAllowed(salesCookie, "/admin/production")));
check("sales is refused /admin/settings", !(await routeAllowed(salesCookie, "/admin/settings")));
check("finance reaches /admin/payments", await routeAllowed(financeCookie, "/admin/payments"));
check("finance is refused /admin/content", !(await routeAllowed(financeCookie, "/admin/content")));
check("marketing reaches /admin/marketing", await routeAllowed(marketingCookie, "/admin/marketing"));
check("marketing is refused /admin/orders", !(await routeAllowed(marketingCookie, "/admin/orders")));
check("a plain admin still reaches /admin/payments", await routeAllowed(adminCookie, "/admin/payments"));
check("a plain admin still reaches /admin/settings", await routeAllowed(adminCookie, "/admin/settings"));
check("a plain admin is refused /admin/team", !(await routeAllowed(adminCookie, "/admin/team")));
check("super_admin reaches /admin/team", await routeAllowed(superCookie, "/admin/team"));
check("super_admin reaches /admin/payments", await routeAllowed(superCookie, "/admin/payments"));

// Nested routes inherit their prefix rule, so a guard cannot be walked
// around by going one level deeper.
check(
  "sales is refused a nested /admin/payments/... route",
  !(await routeAllowed(salesCookie, "/admin/payments/anything"))
);

// ---------------------------------------------------------------------
for (const id of created) await admin.auth.admin.deleteUser(id);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
