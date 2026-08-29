// Module 38 — the MCP write tools and the confirmation replay ledger.
//
// Module 36 proved the foundation and Module 37 proved the readers. This
// is the first suite where a failing assertion means DATA WAS CHANGED
// that should not have been, so its weight sits on four things:
//
//  1. THE REPLAY LEDGER (0063). A confirmation token is a stateless HMAC
//     and stays verifiable for its whole five-minute life, so the
//     signature check alone proves "an admin confirmed this action", not
//     "this action has not already run". The same token must archive a
//     product ONCE. The second attempt must be refused with CONFLICT,
//     and the row must be untouched by it.
//
//  2. OMISSION IS NOT DELETION. An assistant asked to fix a typo sends
//     one field. If the updater treated the missing fields as null it
//     would blank the price, the SKU and every photograph — a
//     destructive act performed by a medium-risk tool with no
//     confirmation. Each partial update here changes one field and
//     asserts the rest survived.
//
//  3. STATUS IS UNREACHABLE FROM THE EDITORS. `products_update` must not
//     be able to publish or archive anything, by any argument, including
//     one the schema was never told about. Publishing is high-risk under
//     12B.6; an editor that could set `status` would be an unconfirmed
//     publish tool wearing a different name.
//
//  4. THE NEGATIVE HALF. Every write refused for every role without
//     catalog.write, no customer reaching any of them, and — checked
//     against the database, not the response — nothing written by a
//     refused call.
//
//   node --env-file=.env.local scripts/test-mcp-write.mjs
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

/** The eleven tools this module adds, with the risk each must declare. */
const WRITE_TOOLS = {
  products_create: "medium",
  products_update: "medium",
  products_publish: "high",
  products_archive: "high",
  collections_create: "medium",
  collections_update: "medium",
  collections_set_visibility: "high",
  builder_options_create: "medium",
  builder_options_update: "medium",
  builder_options_activate: "medium",
  builder_options_deactivate: "high",
};

// =====================================================================
console.log("# Part A — the invariants, asserted at the source");
// =====================================================================

const serverSource = readFileSync("src/lib/mcp/server.ts", "utf8");

// The ordering IS the protection. Acting first and recording second
// leaves a window where two concurrent calls both pass the signature
// check and both write, which is the failure the ledger exists to stop.
check(
  "the dispatcher spends the confirmation BEFORE it runs the handler",
  serverSource.indexOf("consumeConfirmation(") < serverSource.indexOf("await tool.handler(")
);
check(
  "a spent confirmation is a CONFLICT, not a silent second run",
  /already-used[\s\S]{0,200}CONFLICT/.test(serverSource)
);
check(
  "an unavailable ledger fails the action closed",
  /spent === "unavailable"[\s\S]*?No changes were made/.test(serverSource)
);

const replaySource = readFileSync("src/lib/mcp/replay.ts", "utf8");
check("the ledger stores the signature, never the whole token", replaySource.includes("token.slice(separator + 1)"));
check("a unique violation reads as already-used", replaySource.includes('return "already-used"'));

const ledgerSql = readFileSync("supabase/migrations/0063_mcp_confirmations.sql", "utf8");
check("the signature is the primary key, so a double spend is impossible", /signature text primary key/.test(ledgerSql));
check("the ledger has RLS enabled", ledgerSql.includes("enable row level security"));
check(
  "no policy grants insert, update or delete on the ledger",
  !/for (insert|update|delete)/i.test(ledgerSql)
);

// The services are callable from two doorways, so neither may contain
// anything that only makes sense in one of them.
for (const file of ["src/lib/catalog/write-catalog.ts", "src/lib/builder/write-options.ts"]) {
  const src = readFileSync(file, "utf8");
  // Matched at statement position: both files EXPLAIN in prose why
  // redirect() lives in the action wrapper, and a naive substring search
  // would fail on the explanation.
  check(`${file} does not redirect — that throws, and MCP has no page to catch it`, !/^\s*redirect\(/m.test(src));
  check(`${file} does not revalidate — the cache is the caller's concern`, !src.includes("revalidatePath"));
  check(`${file} takes an explicit client rather than building one from cookies`, !src.includes("createClient("));
  check(`${file} returns the new id so an audit row can name the record`, src.includes("ok: true"));
}

const writeToolSource = readFileSync("src/lib/mcp/tools/catalog-write.ts", "utf8");
check("every write tool passes the caller's client (readerOptions/ctx.supabase)", writeToolSource.includes("ctx.supabase"));
check("the editors carry the stored status forward", writeToolSource.includes("status: existing.status"));
check("products_create can only make a draft", writeToolSource.includes('status: "draft"'));
check("no write tool takes a table name (12B.15)", !/optionSet: z\.string\(\)/.test(writeToolSource));

// The read-tool file must stay read-only; the split is what makes "what
// can the AI change" answerable by reading one file.
check(
  "the read-tool file still declares no write tool",
  !readFileSync("src/lib/mcp/tools/catalog.ts", "utf8").includes('kind: "write"')
);

// =====================================================================
console.log("\n# Part B — the live endpoint, with real accounts");
// =====================================================================

const suffix = Date.now();
const createdUsers = [];
const createdProducts = [];
const createdCollections = [];
const createdOptions = [];
await purgeDevtestData(admin);

async function actor(role) {
  const email = `m38-${role}-${suffix}@luxury-couture-devtest.local`;
  const password = `m38-test-${role}-${suffix}`;
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
  marketing: await actor("marketing"),
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

/** Calls a high-risk tool twice: once to be offered a token, once to execute. */
async function confirmAndRun(who, name, args) {
  const proposal = await structured(who, name, args);
  if (proposal?.status !== "CONFIRMATION_REQUIRED") return { proposal, executed: null };
  const executed = await structured(who, name, {
    ...args,
    confirmationToken: proposal.confirmationToken,
  });
  return { proposal, executed, token: proposal.confirmationToken };
}

const productRow = (id) => admin.from("products").select("*").eq("id", id).maybeSingle();

// ---- Registration ----------------------------------------------------
console.log("\n## Registration");

const list = await rpc(actors.super_admin, { jsonrpc: "2.0", id: 1, method: "tools/list" });
const listed = list.json?.result?.tools ?? [];
const byName = new Map(listed.map((t) => [t.name, t]));

check("tools/list still renders — no schema in this module is unrepresentable", listed.length > 0);

for (const [name, risk] of Object.entries(WRITE_TOOLS)) {
  const tool = byName.get(name);
  check(`${name} is registered`, Boolean(tool));
  check(`${name} declares catalog.write`, tool?._meta?.permission === "catalog.write");
  check(`${name} is a write tool`, tool?._meta?.kind === "write");
  check(`${name} is ${risk} risk`, tool?._meta?.risk === risk);
  check(
    `${name} ${risk === "high" ? "requires" : "does not require"} confirmation`,
    tool?._meta?.confirmationRequired === (risk === "high")
  );
  check(`${name} is not annotated read-only`, tool?.annotations?.readOnlyHint === false);
  // Every write tool's description must state a boundary — what it will
  // not do, or what it leaves alone. A model that is only told what a
  // tool does will reach for the nearest one.
  check(
    `${name} describes what it refuses to do`,
    /cannot|does not|is not|not deleted|changes nothing|leaves? .* alone|left exactly as it was|never/i.test(
      tool?.description ?? ""
    )
  );
  check(`${name} advertises a JSON schema`, Boolean(tool?.inputSchema?.type === "object"));
  check(`${name} advertises no status field`, !("status" in (tool?.inputSchema?.properties ?? {})));
}

// ---- Authorization ---------------------------------------------------
console.log("\n## Authorization (only catalog.write may write)");

/**
 * A refusal reaches the caller two ways: a customer never gets past the
 * transport, so it arrives as a JSON-RPC error, while an admin without
 * the key is refused inside the dispatcher and gets the result envelope.
 * Both are refusals and the test cares about the code, not the shape.
 */
async function refusalCode(who, name, args = {}) {
  const res = await call(who, name, args);
  return res.json?.error?.data?.code ?? res.json?.result?.structuredContent?.errorCode ?? null;
}

for (const role of ["marketing", "production", "customer"]) {
  for (const name of Object.keys(WRITE_TOOLS)) {
    const res = { code: await refusalCode(actors[role], name, {}) };
    check(
      `${role} is refused ${name}`,
      ["FORBIDDEN", "UNAUTHORIZED"].includes(res.code)
    );
  }
}

// A refusal must be checked against the DATABASE, not the response: a
// tool that wrote and then reported a failure is the worst of both.
const beforeRefusal = (await admin.from("products").select("id", { count: "exact", head: true })).count;
await structured(actors.marketing, "products_create", {
  name: `m38 forbidden ${suffix}`,
  slug: `m38-forbidden-${suffix}`,
  basePrice: 100,
});
const afterRefusal = (await admin.from("products").select("id", { count: "exact", head: true })).count;
check("a refused create wrote nothing to the database", beforeRefusal === afterRefusal);

// ---- Create ----------------------------------------------------------
console.log("\n## products_create");

const created = await structured(actors.super_admin, "products_create", {
  name: `M38 Test Lehenga ${suffix}`,
  slug: `m38-test-lehenga-${suffix}`,
  sku: `M38-${suffix}`,
  description: "A product created by the Module 38 suite.",
  basePrice: 1250.5,
  isFeatured: false,
  images: [{ url: "https://example.com/m38-a.jpg", altText: "First", isPrimary: true }],
});
check("products_create succeeds", created?.status === "SUCCESS");
const productId = created?.data?.id ?? null;
if (productId) createdProducts.push(productId);
check("products_create returns the new id", Boolean(productId));
check("the created product names the record in its target", created?.target?.id === productId);

const { data: createdRow } = await productRow(productId);
check("the product exists in the database", Boolean(createdRow));
check("a created product is a DRAFT, whatever was asked for", createdRow?.status === "draft");
check("a draft has no published_at", createdRow?.published_at === null);
check("the price was stored", Number(createdRow?.base_price) === 1250.5);
check("the currency defaulted to GBP", createdRow?.currency === "GBP");

const { data: createdImages } = await admin.from("product_images").select("*").eq("product_id", productId);
check("the image list was stored", (createdImages ?? []).length === 1);

check(
  "a duplicate slug is refused as a business-rule error, not a database error",
  (
    await structured(actors.super_admin, "products_create", {
      name: "Duplicate",
      slug: `m38-test-lehenga-${suffix}`,
      basePrice: 10,
    })
  )?.errorCode === "BUSINESS_RULE_ERROR"
);

// ---- Partial update: omission is not deletion ------------------------
console.log("\n## products_update (omission is not deletion)");

const renamed = await structured(actors.super_admin, "products_update", {
  id: productId,
  name: `M38 Renamed ${suffix}`,
});
check("a one-field update succeeds", renamed?.status === "SUCCESS");

const { data: afterRename } = await productRow(productId);
check("the field asked for changed", afterRename?.name === `M38 Renamed ${suffix}`);
check("the price survived an update that did not mention it", Number(afterRename?.base_price) === 1250.5);
check("the sku survived", afterRename?.sku === `M38-${suffix}`);
check("the description survived", afterRename?.description?.includes("Module 38"));
check("the slug survived", afterRename?.slug === `m38-test-lehenga-${suffix}`);

const { data: imagesAfterRename } = await admin.from("product_images").select("*").eq("product_id", productId);
check("the photographs survived an update that did not mention images", (imagesAfterRename ?? []).length === 1);

// The explicit empty list still means what it says.
await structured(actors.super_admin, "products_update", { id: productId, images: [] });
const { data: imagesAfterClear } = await admin.from("product_images").select("*").eq("product_id", productId);
check("an explicitly empty image list does clear the images", (imagesAfterClear ?? []).length === 0);

await structured(actors.super_admin, "products_update", {
  id: productId,
  images: [
    { url: "https://example.com/m38-b.jpg", altText: "Restored", isPrimary: true },
    { url: "https://example.com/m38-c.jpg", isPrimary: false },
  ],
});
const { data: imagesRestored } = await admin.from("product_images").select("*").eq("product_id", productId);
check("an image list replaces wholesale", (imagesRestored ?? []).length === 2);

// ---- Status is unreachable from the editors --------------------------
console.log("\n## Status is unreachable from the editors");

check(
  "products_update refuses a status argument outright",
  (await structured(actors.super_admin, "products_update", { id: productId, status: "published" }))?.errorCode ===
    "VALIDATION_ERROR"
);
check(
  "products_create refuses a status argument outright",
  (
    await structured(actors.super_admin, "products_create", {
      name: "Sneaky",
      slug: `m38-sneaky-${suffix}`,
      basePrice: 1,
      status: "published",
    })
  )?.errorCode === "VALIDATION_ERROR"
);
const { data: stillDraft } = await productRow(productId);
check("the product is still a draft after both attempts", stillDraft?.status === "draft");

// ---- The confirmation gate -------------------------------------------
console.log("\n## The confirmation gate (12B.6)");

const proposal = await structured(actors.super_admin, "products_publish", { id: productId });
check("a high-risk call without a token does not execute", proposal?.status === "CONFIRMATION_REQUIRED");
check("the proposal states the blast radius", proposal?.affectedRecords === 1);
check("the proposal names the record, not just the action", proposal?.summary?.includes(`M38 Renamed ${suffix}`));
check("the proposal carries a token", typeof proposal?.confirmationToken === "string");
const { data: notPublished } = await productRow(productId);
check("nothing was published by the proposal", notPublished?.status === "draft");

// A token is bound to the tool, the arguments and the actor.
check(
  "the publish token does not work on archive",
  (
    await structured(actors.super_admin, "products_archive", {
      id: productId,
      confirmationToken: proposal.confirmationToken,
    })
  )?.status === "CONFIRMATION_REQUIRED"
);
check(
  "a forged token is refused",
  (await structured(actors.super_admin, "products_publish", { id: productId, confirmationToken: "9999999999999.forged" }))
    ?.status === "CONFIRMATION_REQUIRED"
);

const published = await structured(actors.super_admin, "products_publish", {
  id: productId,
  confirmationToken: proposal.confirmationToken,
});
check("the confirmed call executes", published?.status === "SUCCESS");
const { data: publishedRow } = await productRow(productId);
check("the product is published", publishedRow?.status === "published");
check("publishing stamped published_at", Boolean(publishedRow?.published_at));
check("the result reports the status it moved from", published?.data?.previousStatus === "draft");

// ---- The replay ledger — the headline of this module -----------------
console.log("\n## The replay ledger (0063)");

const replayed = await structured(actors.super_admin, "products_publish", {
  id: productId,
  confirmationToken: proposal.confirmationToken,
});
check("the SAME token cannot be spent twice", replayed?.status === "FAILED");
check("a replay reports CONFLICT", replayed?.errorCode === "CONFLICT");
check("the replay refusal says nothing was done twice", /already been used/i.test(replayed?.message ?? ""));

const { data: ledgerRows } = await admin
  .from("mcp_confirmations")
  .select("*")
  .eq("actor_id", actors.super_admin.id);
check("the ledger recorded the spend", (ledgerRows ?? []).length === 1);
check("the ledger records which tool was confirmed", ledgerRows?.[0]?.tool_name === "products_publish");
check(
  "the ledger stores the signature only, never the assembled token",
  !ledgerRows?.[0]?.signature?.includes(".") && proposal.confirmationToken.includes(ledgerRows?.[0]?.signature ?? " ")
);

// Two concurrent confirmed calls: exactly one must win. This is the race
// the primary key exists to decide.
const archive = await structured(actors.super_admin, "products_archive", { id: productId });
const [raceA, raceB] = await Promise.all([
  structured(actors.super_admin, "products_archive", { id: productId, confirmationToken: archive.confirmationToken }),
  structured(actors.super_admin, "products_archive", { id: productId, confirmationToken: archive.confirmationToken }),
]);
const outcomes = [raceA?.status, raceB?.status].sort();
check("of two concurrent identical confirmations, exactly one succeeds", outcomes.join() === "FAILED,SUCCESS");
check(
  "the loser of the race reports CONFLICT",
  [raceA, raceB].find((r) => r?.status === "FAILED")?.errorCode === "CONFLICT"
);
const { data: archivedRow } = await productRow(productId);
check("the product was archived exactly once", archivedRow?.status === "archived");
check("archiving cleared published_at", archivedRow?.published_at === null);
check("archiving deleted nothing", Boolean(archivedRow));

// ---- Collections -----------------------------------------------------
console.log("\n## Collections");

const collection = await structured(actors.super_admin, "collections_create", {
  name: `M38 Collection ${suffix}`,
  slug: `m38-collection-${suffix}`,
  description: "Created by the Module 38 suite.",
});
check("collections_create succeeds", collection?.status === "SUCCESS");
const collectionId = collection?.data?.id ?? null;
if (collectionId) createdCollections.push(collectionId);

const collectionRow = async () =>
  (await admin.from("collections").select("*").eq("id", collectionId).maybeSingle()).data;
check("a created collection is NOT visible on the storefront", (await collectionRow())?.is_active === false);

await structured(actors.super_admin, "collections_update", {
  id: collectionId,
  name: `M38 Collection Renamed ${suffix}`,
});
const renamedCollection = await collectionRow();
check("a collection update changes what it was given", renamedCollection?.name === `M38 Collection Renamed ${suffix}`);
check("a collection update leaves visibility alone", renamedCollection?.is_active === false);
check("a collection update leaves the description alone", renamedCollection?.description?.includes("Module 38"));

const visibility = await confirmAndRun(actors.super_admin, "collections_set_visibility", {
  id: collectionId,
  visible: true,
});
check("making a collection visible asks first", visibility.proposal?.status === "CONFIRMATION_REQUIRED");
check("the confirmed call makes it visible", visibility.executed?.status === "SUCCESS");
check("the collection is visible in the database", (await collectionRow())?.is_active === true);

// ---- Builder options -------------------------------------------------
console.log("\n## Builder options");

const option = await structured(actors.super_admin, "builder_options_create", {
  optionSet: "fabric",
  name: `M38 Silk ${suffix}`,
  slug: `m38-silk-${suffix}`,
  priceAdjustment: 75,
  description: "Created by the Module 38 suite.",
});
check("builder_options_create succeeds", option?.status === "SUCCESS");
const optionId = option?.data?.id ?? null;
if (optionId) createdOptions.push(optionId);

const optionRow = async () =>
  (await admin.from("fabrics").select("*").eq("id", optionId).maybeSingle()).data;
check("a created option is NOT offered to customers", (await optionRow())?.is_active === false);
check("the price adjustment was stored", Number((await optionRow())?.price_adjustment) === 75);

await structured(actors.super_admin, "builder_options_update", {
  optionSet: "fabric",
  id: optionId,
  priceAdjustment: 95,
});
const updatedOption = await optionRow();
check("an option update changes what it was given", Number(updatedOption?.price_adjustment) === 95);
check("an option update leaves the name alone", updatedOption?.name === `M38 Silk ${suffix}`);
check("an option update leaves the description alone", updatedOption?.description?.includes("Module 38"));
check("an option update cannot activate an option", updatedOption?.is_active === false);

check(
  "activating an option needs no confirmation — it is additive",
  (await structured(actors.super_admin, "builder_options_activate", { optionSet: "fabric", id: optionId }))?.status ===
    "SUCCESS"
);
check("the option is offered to customers", (await optionRow())?.is_active === true);

const withdrawal = await confirmAndRun(actors.super_admin, "builder_options_deactivate", {
  optionSet: "fabric",
  id: optionId,
});
check("withdrawing an option asks first", withdrawal.proposal?.status === "CONFIRMATION_REQUIRED");
check("the withdrawal proposal names the option", withdrawal.proposal?.summary?.includes(`M38 Silk ${suffix}`));
check("the confirmed withdrawal executes", withdrawal.executed?.status === "SUCCESS");
check("the option is withdrawn, not deleted", (await optionRow())?.is_active === false);

// 12B.15 — a table name is not an option set, on a WRITE path either.
for (const attempt of ["profiles", "fabrics", "products", "auth.users"]) {
  check(
    `builder_options_create refuses the table name "${attempt}"`,
    (
      await structured(actors.super_admin, "builder_options_create", {
        optionSet: attempt,
        name: "x",
        slug: "x",
      })
    )?.errorCode === "VALIDATION_ERROR"
  );
}

// ---- Validation ------------------------------------------------------
console.log("\n## Validation");

check(
  "an unknown field is refused (schemas are strict)",
  (await structured(actors.super_admin, "products_update", { id: productId, sneaky: true }))?.errorCode ===
    "VALIDATION_ERROR"
);
check(
  "a malformed uuid is a validation error, not a database error",
  (await structured(actors.super_admin, "products_update", { id: "not-a-uuid" }))?.errorCode === "VALIDATION_ERROR"
);
check(
  "an invalid slug is refused",
  (
    await structured(actors.super_admin, "products_create", {
      name: "Bad slug",
      slug: "Not A Slug",
      basePrice: 10,
    })
  )?.errorCode === "VALIDATION_ERROR"
);
check(
  "a negative price is refused",
  (
    await structured(actors.super_admin, "products_create", {
      name: "Negative",
      slug: `m38-negative-${suffix}`,
      basePrice: -5,
    })
  )?.errorCode === "VALIDATION_ERROR"
);
check(
  "a missing record is NOT_FOUND, not a silent success",
  (await structured(actors.super_admin, "products_update", {
    id: "00000000-0000-0000-0000-000000000000",
    name: "Ghost",
  }))?.errorCode === "NOT_FOUND"
);

// ---- Audit -----------------------------------------------------------
console.log("\n## Audit (12B.7: every write is recorded, failures included)");

const { data: auditRows } = await admin
  .from("audit_logs")
  .select("action, entity_id, actor_id")
  .eq("actor_id", actors.super_admin.id)
  .like("action", "mcp.%");
const actions = new Set((auditRows ?? []).map((r) => r.action));
for (const name of ["products_create", "products_update", "products_publish", "products_archive"]) {
  check(`${name} wrote an audit row`, actions.has(`mcp.${name}`));
}
check(
  "the audit row points at the record that changed",
  (auditRows ?? []).some((r) => r.entity_id === productId)
);
const { data: refusedAudit } = await admin
  .from("audit_logs")
  .select("action")
  .eq("actor_id", actors.marketing.id)
  .like("action", "mcp.%");
check("a refused write is recorded too", (refusedAudit ?? []).length > 0);

// ---- Secret leakage --------------------------------------------------
console.log("\n## Secret leakage");

const blob = [
  (await call(actors.super_admin, "products_update", { id: productId, name: "Leak check" })).text,
  (await call(actors.super_admin, "products_publish", { id: productId })).text,
  (await call(actors.marketing, "products_create", { name: "x", slug: "x", basePrice: 1 })).text,
].join("\n");
check("no service-role key appears in any write result", !blob.includes(serviceKey));
check("no anon key appears in any write result", !blob.includes(anonKey));
check("no connection string appears in any write result", !/postgres(ql)?:\/\//.test(blob));
check("no table name is echoed back to the caller", !/\bproduct_images\b|\bseo_metadata\b/.test(blob));

// ---- Cleanup ---------------------------------------------------------
for (const id of createdOptions) await admin.from("fabrics").delete().eq("id", id);
for (const id of createdCollections) await admin.from("collections").delete().eq("id", id);
for (const id of createdProducts) {
  await admin.from("seo_metadata").delete().eq("entity_type", "product").eq("entity_id", id);
  await admin.from("products").delete().eq("id", id);
}
await admin.from("products").delete().like("slug", `m38-%-${suffix}`);
await admin.from("mcp_confirmations").delete().in(
  "actor_id",
  createdUsers
);
for (const id of createdUsers) await admin.auth.admin.deleteUser(id);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
