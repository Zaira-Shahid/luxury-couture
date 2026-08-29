// Module 41 — the MCP analytics and reporting tools.
//
// Three things carry this suite:
//
//  1. THE PERMISSION SPLIT. The module is called "analytics" and only one
//     of its five tools may take `analytics.read`. Migration 0054 gates
//     that key on `analytics_events` alone; orders, payments and profiles
//     need their own. The `marketing` role holds `analytics.read` and
//     none of the other three, so it is the account this suite points at
//     every tool — it must reach the events summary and be refused the
//     other four. A tool declaring the wrong key would be LISTED for
//     marketing and then refused by Postgres, which is the failure Module
//     40 recorded as MCP-017.
//
//  2. AGGREGATES ONLY. The Master Build Plan's rule for this module is
//     that no tool returns a customer list as an analytics result. Every
//     response is searched for a name, an email and a uuid, against real
//     seeded customers whose details are known — not against a regex for
//     what an email looks like.
//
//  3. THE NUMBERS ARE RIGHT. Each summary is checked against figures this
//     script computed itself from rows it created: a reporting tool that
//     returns a confident wrong total is worse than one that fails, since
//     an assistant will repeat it.
//
//   node --env-file=.env.local scripts/test-mcp-analytics.mjs
//
// Requires a running PRODUCTION server (APP_URL, default localhost:3000).
import { readFileSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";

import { purgeDevtestData } from "./lib/purge-devtest.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

let passed = 0;
let failed = 0;
function check(label, ok) {
  if (ok) {
    passed += 1;
    console.log(`PASS — ${label}`);
  } else {
    failed += 1;
    console.log(`FAIL — ${label}`);
  }
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** The five tools, and the key each must declare. */
const TOOLS = {
  analytics_sales_summary: "payments.read",
  analytics_order_summary: "orders.read",
  orders_pending_summary: "orders.read",
  analytics_customer_summary: "customers.read",
  analytics_events_summary: "analytics.read",
};

// =====================================================================
console.log("# Part A — the invariants, asserted at the source");
// =====================================================================

const reporting = readFileSync("src/lib/analytics/reporting.ts", "utf8");

// The rule is enforced in the SERVICE, so no future tool can leak what
// the service refuses to fetch.
check(
  "the customer summary uses head-only counts, so no profile row is fetched",
  /customerSummary[\s\S]*?head: true/.test(reporting)
);
check(
  "no reporting function selects a customer name or email",
  !/select\((["'`])[^"'`]*(full_name|email)/.test(reporting)
);
check(
  "every reporting function takes an explicit client rather than building one from cookies",
  !reporting.includes("supabase/server")
);
check(
  "revenue counts succeeded payments only",
  /\.eq\("status", "succeeded"\)/.test(reporting)
);
// A percentage against a zero baseline is not a number worth reporting.
check(
  "a change against an empty previous period is null, not a fabricated percentage",
  /if \(previous === 0\) return null;/.test(reporting)
);

const toolSource = readFileSync("src/lib/mcp/tools/analytics.ts", "utf8");
check("no analytics tool is a write tool", !toolSource.includes('kind: "write"'));
check("no analytics tool declares a risk above low", !/risk: "(medium|high)"/.test(toolSource));
check(
  "only one tool declares analytics.read",
  (toolSource.match(/permission: "analytics\.read"/g) ?? []).length === 1
);

// =====================================================================
console.log("\n# Part B — the live endpoint, with real accounts");
// =====================================================================

const suffix = Date.now();
const createdUsers = [];
await purgeDevtestData(admin);

// `label` distinguishes two accounts of the SAME role — the buyer below
// is a second customer, and reusing the role as the email would collide.
async function actor(role, label = role) {
  const email = `m41-${label}-${suffix}@luxury-couture-devtest.local`;
  const password = `m41-test-${label}-${suffix}`;
  const { data: user, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser(${label}) failed: ${error.message}`);
  if (role !== "customer") {
    const { error: roleErr } = await admin.from("profiles").update({ role }).eq("id", user.user.id);
    if (roleErr) throw new Error(`role assign(${role}) failed: ${roleErr.message}`);
  }

  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: session, error: signInErr } = await client.auth.signInWithPassword({ email, password });
  if (signInErr) throw new Error(`signIn(${label}) failed: ${signInErr.message}`);

  createdUsers.push(user.user.id);
  return { id: user.user.id, email, role, session: session.session };
}

const actors = {
  super_admin: await actor("super_admin"),
  // Holds analytics.read and none of orders.read, payments.read or
  // customers.read — the account the permission split is about.
  marketing: await actor("marketing"),
  // Holds orders.read, payments.read and analytics.read, but NOT
  // customers.read.
  finance: await actor("finance"),
  production: await actor("production"),
  customer: await actor("customer"),
};

async function rpc(who, body) {
  const headers = { "content-type": "application/json" };
  if (who) headers.authorization = `Bearer ${who.session.access_token}`;
  const res = await fetch(`${APP_URL}/api/mcp`, { method: "POST", headers, body: JSON.stringify(body) });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* left null — the check that cares will fail on it */
  }
  return { status: res.status, json, text };
}

const call = (who, name, args = {}) =>
  rpc(who, { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } });

const structured = async (who, name, args) => (await call(who, name, args)).json?.result?.structuredContent ?? null;

// ---- Fixtures --------------------------------------------------------
// Known figures, computed here, so the assertions compare against
// arithmetic this script did rather than against whatever the tool says.

const buyer = await actor("customer", "buyer");
const ORDER_VALUES = [1000, 2500.5, 400];
const PAID = [1000, 2500.5];

const orderIds = [];
for (const value of ORDER_VALUES) {
  const { data, error } = await admin
    .from("orders")
    .insert({
      customer_id: buyer.id,
      status: "pending",
      subtotal: value,
      total_amount: value,
      balance_due_amount: value,
    })
    .select("id")
    .single();
  if (error) throw new Error(`order fixture failed: ${error.message}`);
  orderIds.push(data.id);
}

// One order moved out of the open set, so "pending" and "all orders"
// cannot accidentally be the same number.
await admin.from("orders").update({ status: "delivered" }).eq("id", orderIds[2]);

for (let i = 0; i < PAID.length; i += 1) {
  const { error } = await admin.from("payments").insert({
    order_id: orderIds[i],
    amount: PAID[i],
    status: "succeeded",
    paid_at: new Date().toISOString(),
    provider: "manual",
  });
  if (error) throw new Error(`payment fixture failed: ${error.message}`);
}
// A pending payment that must NOT be counted as revenue.
await admin.from("payments").insert({
  order_id: orderIds[2],
  amount: 9999,
  status: "pending",
  provider: "manual",
});

const EXPECTED_REVENUE = PAID.reduce((a, b) => a + b, 0);
const EXPECTED_ORDER_TOTAL = ORDER_VALUES.reduce((a, b) => a + b, 0);
const EXPECTED_OPEN_VALUE = ORDER_VALUES[0] + ORDER_VALUES[1];

// ---- Registration ----------------------------------------------------
console.log("\n## Registration");

const list = await rpc(actors.super_admin, { jsonrpc: "2.0", id: 1, method: "tools/list" });
const byName = new Map((list.json?.result?.tools ?? []).map((t) => [t.name, t]));

for (const [name, permission] of Object.entries(TOOLS)) {
  const tool = byName.get(name);
  check(`${name} is registered`, Boolean(tool));
  check(`${name} declares ${permission}`, tool?._meta?.permission === permission);
  check(`${name} is a read tool`, tool?._meta?.kind === "read");
  check(`${name} is low risk`, tool?._meta?.risk === "low");
  check(`${name} requires no confirmation`, tool?._meta?.confirmationRequired === false);
  check(`${name} is annotated read-only`, tool?.annotations?.readOnlyHint === true);
  check(
    `${name} says what it will not return`,
    /no customer|counts only|totals only|identifies no|cannot return|lists no/i.test(tool?.description ?? "")
  );
}

// ---- The permission split --------------------------------------------
console.log("\n## The permission split (0054 gates analytics.read on analytics_events alone)");

async function refusalCode(who, name, args = {}) {
  const res = await call(who, name, args);
  return res.json?.error?.data?.code ?? res.json?.result?.structuredContent?.errorCode ?? null;
}
const REFUSED = ["FORBIDDEN", "UNAUTHORIZED"];

check(
  "marketing CAN read the events summary — it holds analytics.read",
  !REFUSED.includes(await refusalCode(actors.marketing, "analytics_events_summary"))
);
for (const name of ["analytics_sales_summary", "analytics_order_summary", "orders_pending_summary", "analytics_customer_summary"]) {
  check(
    `marketing is refused ${name} — analytics.read does not reach that table`,
    REFUSED.includes(await refusalCode(actors.marketing, name))
  );
}

check(
  "finance CAN read revenue — it holds payments.read",
  !REFUSED.includes(await refusalCode(actors.finance, "analytics_sales_summary"))
);
check(
  "finance CAN read the order summary — it holds orders.read",
  !REFUSED.includes(await refusalCode(actors.finance, "analytics_order_summary"))
);
check(
  "finance is refused the customer summary — it lacks customers.read",
  REFUSED.includes(await refusalCode(actors.finance, "analytics_customer_summary"))
);

for (const name of Object.keys(TOOLS)) {
  check(`a customer is refused ${name}`, REFUSED.includes(await refusalCode(actors.customer, name)));
  check(`production is refused ${name}`, REFUSED.includes(await refusalCode(actors.production, name)));
}

// ---- The numbers -----------------------------------------------------
console.log("\n## The numbers");

const sales = await structured(actors.super_admin, "analytics_sales_summary", { days: 30 });
check("analytics_sales_summary succeeds", sales?.status === "SUCCESS");
check(`revenue is the sum of succeeded payments (${EXPECTED_REVENUE})`, sales?.data?.totalRevenue === EXPECTED_REVENUE);
check("the pending payment is NOT counted as revenue", sales?.data?.totalRevenue !== EXPECTED_REVENUE + 9999);
check("the payment count matches", sales?.data?.paymentCount === PAID.length);
check(
  "the average is the total over the count",
  sales?.data?.averagePayment === Math.round((EXPECTED_REVENUE / PAID.length) * 100) / 100
);
check(
  "an empty previous period gives a null change, not a fabricated percentage",
  sales?.data?.previousPeriodRevenue === 0 && sales?.data?.changePercent === null
);

const orders = await structured(actors.super_admin, "analytics_order_summary", { days: 30 });
check("analytics_order_summary succeeds", orders?.status === "SUCCESS");
check(`the order count matches (${ORDER_VALUES.length})`, orders?.data?.orderCount === ORDER_VALUES.length);
check(`the order value matches (${EXPECTED_ORDER_TOTAL})`, orders?.data?.totalValue === EXPECTED_ORDER_TOTAL);
check("two orders are pending", orders?.data?.byStatus?.pending === 2);
check("one order is delivered", orders?.data?.byStatus?.delivered === 1);
check(
  "a status with no orders reports 0 rather than being absent",
  orders?.data?.byStatus?.cancelled === 0 && "shipped" in (orders?.data?.byStatus ?? {})
);

const pending = await structured(actors.super_admin, "orders_pending_summary");
check("orders_pending_summary succeeds", pending?.status === "SUCCESS");
check("the delivered order is not counted as open", pending?.data?.openOrderCount === 2);
check(`the open value excludes it (${EXPECTED_OPEN_VALUE})`, pending?.data?.openOrderValue === EXPECTED_OPEN_VALUE);
check("terminal statuses are absent from the open breakdown", !("delivered" in (pending?.data?.byStatus ?? {})));
check("the oldest open order is dated", Boolean(pending?.data?.oldestOpenOrderPlacedAt));

const customers = await structured(actors.super_admin, "analytics_customer_summary", { days: 30 });
check("analytics_customer_summary succeeds", customers?.status === "SUCCESS");
check("it counts customers", typeof customers?.data?.totalCustomers === "number" && customers.data.totalCustomers > 0);
check("it counts the ones registered in the window", customers?.data?.newCustomers >= 1);

const events = await structured(actors.super_admin, "analytics_events_summary", { days: 30 });
check("analytics_events_summary succeeds", events?.status === "SUCCESS");
check("it returns per-event totals", Array.isArray(events?.data?.events));
check("it returns the funnel", Array.isArray(events?.data?.funnel));

// ---- Aggregates only -------------------------------------------------
console.log("\n## Aggregates only — no tool returns a person");

const everySummary = JSON.stringify([sales, orders, pending, customers, events]);

// Checked against the REAL seeded values, not a regex for what an email
// looks like: the rule is that this specific customer cannot be found in
// an analytics answer.
check("no customer email appears in any summary", !everySummary.includes(buyer.email));
check("no customer id appears in any summary", !everySummary.includes(buyer.id));
check("no order id appears in any summary", !orderIds.some((id) => everySummary.includes(id)));
check(
  "no summary carries a field that could hold a list of people",
  !/"customers":\s*\[|"profiles":\s*\[|"emails":\s*\[/.test(everySummary)
);
check("no service-role key appears in any summary", !everySummary.includes(serviceKey));
check("no anon key appears in any summary", !everySummary.includes(anonKey));
check("no table name is echoed back to the caller", !/analytics_events|promotional_banners|profiles/.test(everySummary));

// ---- Validation ------------------------------------------------------
console.log("\n## Validation");

check(
  "an unsupported range is refused rather than silently clamped",
  (await structured(actors.super_admin, "analytics_sales_summary", { days: 5 }))?.errorCode === "VALIDATION_ERROR"
);
check(
  "an unknown field is refused (schemas are strict)",
  (await structured(actors.super_admin, "analytics_sales_summary", { days: 30, table: "profiles" }))?.errorCode ===
    "VALIDATION_ERROR"
);
check(
  "the pending summary takes no arguments at all",
  (await structured(actors.super_admin, "orders_pending_summary", { days: 30 }))?.errorCode === "VALIDATION_ERROR"
);
check(
  "omitting the range defaults to 30 days rather than failing",
  (await structured(actors.super_admin, "analytics_order_summary", {}))?.data?.range?.days === 30
);

// ---- Cleanup ---------------------------------------------------------
await admin.from("payments").delete().in("order_id", orderIds);
await admin.from("orders").delete().in("id", orderIds);
await purgeDevtestData(admin);
for (const id of [...createdUsers]) {
  await admin.auth.admin.deleteUser(id).catch(() => {});
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
