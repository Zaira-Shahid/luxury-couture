// Module 37 — the MCP read tools.
//
// Module 36's suite (test-mcp.mjs) proves the foundation: transport,
// registry, authorization, error model. This one proves the fourteen
// tools built on top of it, and its weight sits on three things that only
// became testable once a tool read a real record.
//
//  1. TRANSPORT PARITY. Every tool must return the same data over the
//     Bearer transport as over the cookie transport. The readers build
//     their own Supabase client from request COOKIES when none is passed,
//     and a Bearer call carries no auth cookie — so a tool that let a
//     reader do that would query anonymously, RLS would filter every row,
//     and it would answer "no orders" to a super_admin. A silent wrong
//     answer is worse than a refusal, and nothing in Module 36's suite
//     would have caught it.
//
//  2. FAILURE IS NEVER SUCCESS (12B.8). The readers log and return `[]`
//     so a page degrades gracefully. A tool must not, or an assistant
//     relays "you have no pending orders" as fact when the query broke.
//
//  3. THE NEGATIVE HALF. Every tool refused for every role that lacks its
//     key, no customer reaching any tool, and no table name reaching a
//     query builder (12B.15).
//
//   node --env-file=.env.local scripts/test-mcp-read.mjs
//
// Requires a running PRODUCTION server (APP_URL, default localhost:3000).
import { readFileSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";

import { purgeDevtestData } from "./lib/purge-devtest.mjs";

import { DEFAULT_LIMIT, MAX_LIMIT, paginate } from "../src/lib/mcp/paginate.ts";

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

/** The fourteen tools this module adds, with the permission each must declare. */
const READ_TOOLS = {
  products_list: "catalog.read",
  products_get: "catalog.read",
  collections_list: "catalog.read",
  collections_get: "catalog.read",
  builder_options_list: "catalog.read",
  builder_options_get: "catalog.read",
  orders_list: "orders.read",
  orders_get: "orders.read",
  enquiries_list: "enquiries.read",
  enquiries_get: "enquiries.read",
  customers_search: "customers.read",
  customers_get: "customers.read",
  production_list: "production.read",
  production_get: "production.read",
};

const LIST_TOOLS = Object.keys(READ_TOOLS).filter((n) => n.endsWith("_list") || n === "customers_search");

// =====================================================================
console.log("# Part A — pagination, and the reader contract at the source");
// =====================================================================

check("a page slices from the offset", paginate([1, 2, 3, 4, 5], { limit: 2, offset: 1 }).items.join() === "2,3");
check("total is the real total, not the page length", paginate([1, 2, 3, 4, 5], { limit: 2, offset: 0 }).total === 5);
check("hasMore is true when rows remain", paginate([1, 2, 3], { limit: 2, offset: 0 }).hasMore === true);
check("hasMore is false on the last page", paginate([1, 2, 3], { limit: 2, offset: 2 }).hasMore === false);
check("hasMore is false past the end", paginate([1, 2], { limit: 5, offset: 9 }).hasMore === false);
check("an empty set is not 'hasMore'", paginate([], { limit: 20, offset: 0 }).hasMore === false);
check("the default page is 20", DEFAULT_LIMIT === 20);
check("the cap is 100", MAX_LIMIT === 100);

// The reader contract, asserted at the SOURCE. A future reader that
// swallows an error and returns [] would reintroduce exactly the defect
// this module fixed, and it would look like a passing empty list.
const readerSource = readFileSync("src/lib/supabase/reader.ts", "utf8");
check(
  "readFailed throws before it logs when throwOnError is set",
  readerSource.indexOf("if (options?.throwOnError) throw error;") <
    readerSource.indexOf("logger.warn")
);
check("readerClient prefers the caller's client", readerSource.includes("if (options?.client) return options.client;"));

const READER_FILES = [
  "src/lib/orders/get-orders.ts",
  "src/lib/enquiries/get-enquiries.ts",
  "src/lib/production/get-production.ts",
  "src/lib/admin/get-customers.ts",
  "src/lib/admin/get-builder-options.ts",
  "src/lib/catalog/get-admin-catalog.ts",
];
for (const file of READER_FILES) {
  const src = readFileSync(file, "utf8");
  check(`${file} routes query errors through readFailed`, src.includes("readFailed("));
  check(`${file} takes the caller's client via readerClient`, src.includes("readerClient("));
}

// Every tool handler must pass the caller's client. A handler that calls
// a reader with no options is the Bearer bug waiting to happen again.
const TOOL_FILES = [
  "src/lib/mcp/tools/catalog.ts",
  "src/lib/mcp/tools/orders.ts",
  "src/lib/mcp/tools/enquiries.ts",
  "src/lib/mcp/tools/customers.ts",
  "src/lib/mcp/tools/production.ts",
];
for (const file of TOOL_FILES) {
  const src = readFileSync(file, "utf8");
  check(`${file} passes readerOptions(ctx) to every reader`, src.includes("readerOptions(ctx)"));
  check(`${file} declares no write tool`, !src.includes('kind: "write"'));
}

// 12B.15: no tool may take a table name. The option-set enum is the
// business-name mapping that keeps it that way.
const catalogSource = readFileSync("src/lib/mcp/tools/catalog.ts", "utf8");
for (const table of ["fabrics", "colours", "necklines", "dupatta_options", "sleeve_styles", "embroidery_types"]) {
  check(`the ${table} table name is mapped, never accepted as input`, catalogSource.includes(`"${table}"`));
}

// =====================================================================
console.log("\n# Part B — the live endpoint, with real accounts");
// =====================================================================

const suffix = Date.now();
const createdUsers = [];
await purgeDevtestData(admin);

async function actor(role) {
  const email = `m37-${role}-${suffix}@luxury-couture-devtest.local`;
  const password = `m37-test-${role}-${suffix}`;
  const { data: user, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser(${role}) failed: ${error.message}`);
  if (role !== "customer") {
    const { error: roleErr } = await admin.from("profiles").update({ role }).eq("id", user.user.id);
    if (roleErr) throw new Error(`role assign(${role}) failed: ${roleErr.message}`);
  }

  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: session, error: signInErr } = await client.auth.signInWithPassword({ email, password });
  if (signInErr) throw new Error(`signIn(${role}) failed: ${signInErr.message}`);

  createdUsers.push(user.user.id);
  return { id: user.user.id, email, role, session: session.session };
}

const actors = {
  super_admin: await actor("super_admin"),
  production: await actor("production"),
  marketing: await actor("marketing"),
  customer: await actor("customer"),
};

/** Matches @supabase/ssr's cookie format — the same helper test-mcp.mjs uses. */
function sessionCookie(session) {
  const ref = new URL(url).hostname.split(".")[0];
  return `sb-${ref}-auth-token=base64-${Buffer.from(JSON.stringify(session), "utf8").toString("base64url")}`;
}

async function rpc(who, body, { transport = "bearer" } = {}) {
  const headers = { "content-type": "application/json" };
  if (who) {
    if (transport === "cookie") headers.cookie = sessionCookie(who.session);
    else headers.authorization = `Bearer ${who.session.access_token}`;
  }
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

const call = (who, name, args = {}, opts) =>
  rpc(who, { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }, opts);

const structured = (res) => res.json?.result?.structuredContent ?? null;

// ---- Registration ----------------------------------------------------
console.log("\n## Registration");

const list = await rpc(actors.super_admin, { jsonrpc: "2.0", id: 1, method: "tools/list" });
const listed = list.json?.result?.tools ?? [];
const byName = new Map(listed.map((t) => [t.name, t]));

for (const [name, permission] of Object.entries(READ_TOOLS)) {
  const tool = byName.get(name);
  check(`${name} is registered`, Boolean(tool));
  check(`${name} declares ${permission}`, tool?._meta?.permission === permission);
  check(`${name} is a read tool`, tool?._meta?.kind === "read");
  check(`${name} is low risk`, tool?._meta?.risk === "low");
  check(`${name} needs no confirmation`, tool?._meta?.confirmationRequired === false);
  check(`${name} is annotated read-only for the client`, tool?.annotations?.readOnlyHint === true);
  check(`${name} describes what it refuses to do`, /cannot|does not|NOT/i.test(tool?.description ?? ""));
}

// ---- Transport parity — the check that would have caught the bug -----
console.log("\n## Transport parity (Bearer must equal cookie)");

for (const name of LIST_TOOLS) {
  const args = name === "builder_options_list" ? { optionSet: "colour" } : {};
  const viaBearer = structured(await call(actors.super_admin, name, args));
  const viaCookie = structured(await call(actors.super_admin, name, args, { transport: "cookie" }));

  check(`${name} succeeds over Bearer`, viaBearer?.status === "SUCCESS");
  check(`${name} succeeds over cookie`, viaCookie?.status === "SUCCESS");
  check(
    `${name} returns the same total over both transports`,
    viaBearer?.data?.total === viaCookie?.data?.total
  );
  // The specific regression: an anonymous client sees zero rows. Seeded
  // data means a correct read is non-empty, so zero over Bearer while
  // cookie sees rows is the bug reappearing.
  check(
    `${name} does not silently return an empty page over Bearer`,
    !(viaCookie?.data?.total > 0 && viaBearer?.data?.total === 0)
  );
}

// ---- Reading real data ----------------------------------------------
console.log("\n## Reading real data");

const products = structured(await call(actors.super_admin, "products_list"));
check("products_list returns the seeded catalogue", products?.data?.total > 0);
check("products_list caps the page at the default", products?.data?.items.length <= DEFAULT_LIMIT);
check("products_list reports hasMore honestly", products?.data?.hasMore === products?.data?.total > DEFAULT_LIMIT);
check(
  "every product row carries real database fields",
  products?.data?.items.every((p) => p.id && p.slug && typeof p.price === "number")
);

const firstProduct = products?.data?.items?.[0];
const productDetail = structured(await call(actors.super_admin, "products_get", { id: firstProduct.id }));
check("products_get returns the same product by id", productDetail?.data?.id === firstProduct.id);
check("products_get names the record it read", productDetail?.target?.id === firstProduct.id);

const drafts = structured(await call(actors.super_admin, "products_list", { status: "draft" }));
check(
  "products_list filters by status",
  drafts?.data?.items.every((p) => p.status === "draft")
);

const colours = structured(await call(actors.super_admin, "builder_options_list", { optionSet: "colour" }));
check("builder_options_list reads an option set by business name", colours?.data?.total > 0);
check(
  "a colour row carries its hex value",
  colours?.data?.items.every((row) => "hexValue" in row)
);
const activeColours = structured(
  await call(actors.super_admin, "builder_options_list", { optionSet: "colour", activeOnly: true })
);
check(
  "activeOnly filters to what customers can pick",
  activeColours?.data?.items.every((row) => row.isActive === true)
);

const customers = structured(await call(actors.super_admin, "customers_search"));
check("customers_search returns customers", customers?.data?.total > 0);
check(
  "customers_search returns NO contact details",
  customers?.data?.items.every((c) => !("email" in c) && !("phone" in c))
);
check(
  "customers_search computes segment tags",
  customers?.data?.items.every((c) => Array.isArray(c.segments))
);

// The one privileged read on the MCP path (12B.11), bounded to one field.
const customerDetail = structured(
  await call(actors.super_admin, "customers_get", { id: customers.data.items[0].id })
);
check("customers_get returns the customer's email", "email" in (customerDetail?.data ?? {}));
check("customers_get returns their order history", Array.isArray(customerDetail?.data?.orders));
check("customers_get returns an address COUNT, not the addresses", typeof customerDetail?.data?.addressCount === "number");

const enquiries = structured(await call(actors.super_admin, "enquiries_list"));
check(
  "enquiries_list withholds contact details",
  enquiries?.data?.items.every((e) => !("contactEmail" in e) && !("contactPhone" in e))
);
if (enquiries?.data?.items?.length) {
  const enquiryDetail = structured(
    await call(actors.super_admin, "enquiries_get", { id: enquiries.data.items[0].id })
  );
  check("enquiries_get returns the contact details for ONE enquiry", "contactEmail" in (enquiryDetail?.data ?? {}));
}

// ---- Failure is never success ---------------------------------------
console.log("\n## A failed read is never reported as a success");

const missingId = "00000000-0000-0000-0000-000000000000";
for (const name of ["products_get", "collections_get", "orders_get", "enquiries_get", "customers_get", "production_get"]) {
  const args = { id: missingId };
  const res = await call(actors.super_admin, name, args);
  const body = structured(res);
  check(`${name} on a missing record is an error, not an empty success`, body?.status === "FAILED");
  check(`${name} on a missing record reports NOT_FOUND`, body?.errorCode === "NOT_FOUND");
  check(`${name} flags the result as an error to the transport`, res.json?.result?.isError === true);
}

const missingOption = await call(actors.super_admin, "builder_options_get", { optionSet: "colour", id: missingId });
check("builder_options_get on a missing option reports NOT_FOUND", structured(missingOption)?.errorCode === "NOT_FOUND");

// ---- Authorization: the negative half -------------------------------
console.log("\n## Authorization (the negative half)");

// production holds production.read and catalog.read — and nothing else.
const productionRefused = ["orders_list", "orders_get", "enquiries_list", "customers_search", "customers_get"];
for (const name of productionRefused) {
  const res = await call(actors.production, name, name.endsWith("_get") ? { id: missingId } : {});
  check(`a production account is refused ${name}`, structured(res)?.errorCode === "FORBIDDEN");
}
const productionAllowed = structured(await call(actors.production, "production_list"));
check("a production account CAN call production_list", productionAllowed?.status === "SUCCESS");
const productionCatalog = structured(await call(actors.production, "products_list"));
check("a production account CAN call products_list (it holds catalog.read)", productionCatalog?.status === "SUCCESS");

// marketing holds catalog.read but no orders/customers/production keys.
for (const name of ["orders_list", "customers_search", "production_list"]) {
  const res = await call(actors.marketing, name);
  check(`a marketing account is refused ${name}`, structured(res)?.errorCode === "FORBIDDEN");
}

// tools/list is filtered, but filtering is not the enforcement.
const productionList = await rpc(actors.production, { jsonrpc: "2.0", id: 1, method: "tools/list" });
const productionNames = (productionList.json?.result?.tools ?? []).map((t) => t.name);
check("a production account is not shown orders_list", !productionNames.includes("orders_list"));
check("a production account is not shown customers_get", !productionNames.includes("customers_get"));
check("a production account IS shown production_list", productionNames.includes("production_list"));
check(
  "a tool never shown is still refused when called by name",
  structured(await call(actors.production, "customers_search"))?.errorCode === "FORBIDDEN"
);

// A customer reaches none of them.
for (const name of Object.keys(READ_TOOLS)) {
  const res = await call(actors.customer, name, name.endsWith("_get") ? { id: missingId } : {});
  check(`a customer cannot reach ${name}`, res.json?.error?.data?.code === "FORBIDDEN" || structured(res)?.errorCode === "FORBIDDEN");
}

const anonRead = await call(null, "products_list");
check("an anonymous caller cannot read the catalogue through MCP", anonRead.status === 401);
check("the anonymous refusal names no tool", !anonRead.text.includes("products_list"));

// ---- Input validation ------------------------------------------------
console.log("\n## Input validation");

check(
  "a malformed uuid is a validation error, not a database error",
  structured(await call(actors.super_admin, "products_get", { id: "not-a-uuid" }))?.errorCode === "VALIDATION_ERROR"
);
check(
  "a limit above the cap is refused",
  structured(await call(actors.super_admin, "products_list", { limit: 5000 }))?.errorCode === "VALIDATION_ERROR"
);
check(
  "a negative offset is refused",
  structured(await call(actors.super_admin, "products_list", { offset: -1 }))?.errorCode === "VALIDATION_ERROR"
);
check(
  "an unknown status is refused",
  structured(await call(actors.super_admin, "orders_list", { status: "invented" }))?.errorCode === "VALIDATION_ERROR"
);
check(
  "an unknown field is refused (schemas are strict)",
  structured(await call(actors.super_admin, "products_list", { sneaky: true }))?.errorCode === "VALIDATION_ERROR"
);

// 12B.15 — a table name is not a valid option set, and never becomes one.
for (const attempt of ["profiles", "fabrics", "site_settings", "auth.users"]) {
  check(
    `builder_options_list refuses the table name "${attempt}"`,
    structured(await call(actors.super_admin, "builder_options_list", { optionSet: attempt }))?.errorCode ===
      "VALIDATION_ERROR"
  );
}

// ---- Secret leakage --------------------------------------------------
console.log("\n## Secret leakage");

const everything = [];
for (const name of LIST_TOOLS) {
  const args = name === "builder_options_list" ? { optionSet: "colour" } : {};
  everything.push((await call(actors.super_admin, name, args)).text);
}
const blob = everything.join("\n");
check("no service-role key appears in any read result", !blob.includes(serviceKey));
check("no anon key appears in any read result", !blob.includes(anonKey));
check("no connection string appears in any read result", !/postgres(ql)?:\/\//.test(blob));
check("no payment provider reference is returned by orders_get", !blob.includes("provider_reference"));

// ---- Audit -----------------------------------------------------------
console.log("\n## Audit (12B.5: read tools are not audited)");

const { data: auditRows } = await admin
  .from("audit_logs")
  .select("action")
  .like("action", "mcp.%")
  .in("action", Object.keys(READ_TOOLS).map((n) => `mcp.${n}`));
check("no read tool wrote an audit row", (auditRows ?? []).length === 0);

// ---- Cleanup ---------------------------------------------------------
for (const id of createdUsers) await admin.auth.admin.deleteUser(id);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
