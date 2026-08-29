// Module 39 — the MCP order, production and enquiry write tools.
//
// Module 38 proved the first writers. This suite's weight sits on the
// thing Module 39 had to BUILD rather than reuse:
//
//  1. THE TRANSITION RULES. The Master Build Plan said these tools should
//     "go through the existing workflow validation". There was none —
//     `orders.status` was checked for enum membership by a Zod schema, by
//     a CHECK constraint, and by nothing else, and the admin dropdown
//     offered every status unconditionally. So a delivered order could be
//     walked back to pending. The rules now exist in
//     src/lib/orders/transitions.ts and src/lib/production/transitions.ts,
//     and most of Part C is the negative half: every backward move, every
//     reopened terminal state, every cancellation of a shipped order.
//
//  2. THE UI KEEPS ITS FREEDOM. The rules are enforced for MCP and not
//     for the admin forms, which pass allowCorrection: true. An admin
//     correcting a mis-click is exactly who should be able to move an
//     order backward, and this module must not have quietly removed a
//     capability the business has. Asserted at the source, because the
//     alternative is asserting it through a browser.
//
//  3. QC CANNOT MOVE WORK, AND PRODUCTION CANNOT SIGN IT OFF. Migration
//     0054 gave qc.write its own INSERT policy specifically so "a QC user
//     must be able to record a result WITHOUT being able to move the job
//     through production themselves". Two tools, two permissions, and the
//     cross-checks in both directions.
//
//  4. THE CUSTOMER IS TOLD — or deliberately is not. An order status
//     change notifies; a QC failure does not. Both are asserted against
//     the notifications table rather than the response.
//
//   node --env-file=.env.local scripts/test-mcp-orders.mjs
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

/** The seven tools this module adds: permission and risk each must declare. */
const WRITE_TOOLS = {
  orders_update_status: { permission: "orders.write", risk: "high" },
  orders_cancel: { permission: "orders.write", risk: "high" },
  orders_add_note: { permission: "orders.write", risk: "medium" },
  production_advance_status: { permission: "production.write", risk: "medium" },
  production_record_qc: { permission: "qc.write", risk: "medium" },
  production_update_details: { permission: "production.write", risk: "medium" },
  enquiries_update_status: { permission: "enquiries.write", risk: "medium" },
};

// =====================================================================
console.log("# Part A — the invariants, asserted at the source");
// =====================================================================

const orderTransitions = readFileSync("src/lib/orders/transitions.ts", "utf8");
const productionTransitions = readFileSync("src/lib/production/transitions.ts", "utf8");

// `cancelled` in the forward sequence would make "cancelled -> delivered"
// look like a legal forward step, because the rule is positional.
check(
  "cancelled is not a stage in the order sequence",
  /ORDER_STATUS_SEQUENCE = \[[\s\S]*?\]/.exec(orderTransitions)?.[0].includes("cancelled") === false
);
check(
  "delivered and cancelled are both terminal",
  /TERMINAL_ORDER_STATUSES = \["delivered", "cancelled"\]/.test(orderTransitions)
);
check(
  "production reuses PRODUCTION_STATUSES as its sequence rather than copying it",
  productionTransitions.includes("PRODUCTION_STATUS_SEQUENCE = PRODUCTION_STATUSES")
);

// The asymmetry that keeps the admin UI working. If these flip, this
// module has taken a capability away from the people who have it.
const orderActions = readFileSync("src/features/admin-orders/actions.ts", "utf8");
const productionActions = readFileSync("src/features/admin-production/actions.ts", "utf8");
const enquiryActions = readFileSync("src/features/admin-enquiries/actions.ts", "utf8");
check("the admin order form still allows corrections", orderActions.includes("allowCorrection: true"));
check("the admin production form still allows corrections", productionActions.includes("allowCorrection: true"));
check("the admin enquiry screen still allows corrections", enquiryActions.includes("allowCorrection: true"));

const ordersWriteTools = readFileSync("src/lib/mcp/tools/orders-write.ts", "utf8");
const productionWriteTools = readFileSync("src/lib/mcp/tools/production-write.ts", "utf8");
const enquiriesWriteTools = readFileSync("src/lib/mcp/tools/enquiries-write.ts", "utf8");
check("no order tool allows a correction", !ordersWriteTools.includes("allowCorrection: true"));
check("no production tool allows a correction", !productionWriteTools.includes("allowCorrection: true"));
check("no enquiry tool allows a correction", !enquiriesWriteTools.includes("allowCorrection: true"));

// The services are callable from MCP at all only because the client is a
// parameter — the actions built theirs from cookies, which a Bearer call
// does not carry (the defect Module 38 recorded).
const writeOrders = readFileSync("src/lib/orders/write-orders.ts", "utf8");
const writeProduction = readFileSync("src/lib/production/write-production.ts", "utf8");
for (const [name, source] of [
  ["src/lib/orders/write-orders.ts", writeOrders],
  ["src/lib/production/write-production.ts", writeProduction],
]) {
  check(`${name} takes an explicit client rather than building one from cookies`, !source.includes("supabase/server"));
  // Matched as CALLS, not as words: both files name these in their
  // header comments to explain why they do not make them.
  check(`${name} does not redirect — that throws, and MCP has no page to catch it`, !/^\s*redirect\(/m.test(source));
  check(`${name} does not revalidate — the cache is the caller's concern`, !/^\s*(await )?revalidatePath\(/m.test(source));
  check(`${name} names the actor in its audit row rather than relying on the cookie fallback`, source.includes("actorId: params.actorId"));
}

// A QC row that recorded `quality_check` would read as though the garment
// had moved to inspection, which is a claim about where the work is.
check(
  "a QC outcome is recorded at the job's CURRENT stage, not at quality_check",
  /status: stage,/.test(writeProduction)
);

// The read-tool files must stay read-only; the split is what makes "what
// can the AI change" answerable by reading one file.
for (const file of ["orders.ts", "production.ts", "enquiries.ts"]) {
  check(
    `the ${file} read-tool file still declares no write tool`,
    !readFileSync(`src/lib/mcp/tools/${file}`, "utf8").includes('kind: "write"')
  );
}

// =====================================================================
console.log("\n# Part B — the live endpoint, with real accounts");
// =====================================================================

const suffix = Date.now();
const createdUsers = [];
await purgeDevtestData(admin);

async function actor(role) {
  const email = `m39-${role}-${suffix}@luxury-couture-devtest.local`;
  const password = `m39-test-${role}-${suffix}`;
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
  sales: await actor("sales"),
  production: await actor("production"),
  qc: await actor("qc"),
  marketing: await actor("marketing"),
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

/** A fresh order owned by the test customer, at a chosen status. */
async function makeOrder(status = "pending") {
  const { data, error } = await admin
    .from("orders")
    .insert({
      customer_id: actors.customer.id,
      status,
      subtotal: 1000,
      total_amount: 1000,
      balance_due_amount: 1000,
    })
    .select("id, order_number, status")
    .single();
  if (error) throw new Error(`makeOrder failed: ${error.message}`);
  return data;
}

async function makeJob(currentStatus = "order_confirmed") {
  const order = await makeOrder("in_production");
  const { data, error } = await admin
    .from("production_orders")
    .insert({ order_id: order.id, current_status: currentStatus })
    .select("id, order_id, current_status")
    .single();
  if (error) throw new Error(`makeJob failed: ${error.message}`);
  return { ...data, order };
}

async function makeEnquiry(status = "new") {
  const { data, error } = await admin
    .from("enquiries")
    .insert({
      contact_name: `M39 Enquiry ${suffix}`,
      contact_email: `m39-enquiry-${suffix}@luxury-couture-devtest.local`,
      message: "Created by the Module 39 suite.",
      status,
    })
    .select("id, status")
    .single();
  if (error) throw new Error(`makeEnquiry failed: ${error.message}`);
  return data;
}

const orderRow = (id) => admin.from("orders").select("*").eq("id", id).maybeSingle();
const jobRow = (id) => admin.from("production_orders").select("*").eq("id", id).maybeSingle();

// ---- Registration ----------------------------------------------------
console.log("\n## Registration");

const list = await rpc(actors.super_admin, { jsonrpc: "2.0", id: 1, method: "tools/list" });
const listed = list.json?.result?.tools ?? [];
const byName = new Map(listed.map((t) => [t.name, t]));

check("tools/list still renders — no schema in this module is unrepresentable", listed.length > 0);

for (const [name, { permission, risk }] of Object.entries(WRITE_TOOLS)) {
  const tool = byName.get(name);
  check(`${name} is registered`, Boolean(tool));
  check(`${name} declares ${permission}`, tool?._meta?.permission === permission);
  check(`${name} is a write tool`, tool?._meta?.kind === "write");
  check(`${name} is ${risk} risk`, tool?._meta?.risk === risk);
  check(
    `${name} ${risk === "high" ? "requires" : "does not require"} confirmation`,
    tool?._meta?.confirmationRequired === (risk === "high")
  );
  check(`${name} is not annotated read-only`, tool?.annotations?.readOnlyHint === false);
  check(
    `${name} describes what it refuses to do`,
    /cannot|does not|is not|never|not notified|changes nothing|leaves? .* unchanged/i.test(tool?.description ?? "")
  );
  check(`${name} advertises a JSON schema`, tool?.inputSchema?.type === "object");
}

// ---- Authorization ---------------------------------------------------
console.log("\n## Authorization (the permission split of migration 0054)");

async function refusalCode(who, name, args = {}) {
  const res = await call(who, name, args);
  return res.json?.error?.data?.code ?? res.json?.result?.structuredContent?.errorCode ?? null;
}

const REFUSED = ["FORBIDDEN", "UNAUTHORIZED"];

for (const name of Object.keys(WRITE_TOOLS)) {
  check(`a customer is refused ${name}`, REFUSED.includes(await refusalCode(actors.customer, name)));
  check(`marketing is refused ${name}`, REFUSED.includes(await refusalCode(actors.marketing, name)));
}

// The cross-checks that matter: each role is refused the OTHER half.
check(
  "production cannot record a quality check — that is what qc.write is for",
  REFUSED.includes(await refusalCode(actors.production, "production_record_qc"))
);
check(
  "qc cannot advance production — recording a result is not moving the work",
  REFUSED.includes(await refusalCode(actors.qc, "production_advance_status"))
);
check(
  "qc cannot touch orders at all",
  REFUSED.includes(await refusalCode(actors.qc, "orders_update_status"))
);
check(
  "production cannot change an order's status",
  REFUSED.includes(await refusalCode(actors.production, "orders_update_status"))
);
check(
  "sales cannot advance production",
  REFUSED.includes(await refusalCode(actors.sales, "production_advance_status"))
);

// A refusal must be checked against the DATABASE, not the response.
const refusedOrder = await makeOrder("pending");
await structured(actors.marketing, "orders_update_status", {
  id: refusedOrder.id,
  status: "confirmed",
});
check(
  "a refused status change wrote nothing to the database",
  (await orderRow(refusedOrder.id)).data?.status === "pending"
);

// =====================================================================
console.log("\n# Part C — the transition rules");
// =====================================================================

console.log("\n## Orders move forward");

const fwd = await makeOrder("pending");

// The proposal is made on its own first. Asserting "nothing changed"
// after confirmAndRun would prove nothing — that helper has already run
// the confirmed call by the time it returns.
const proposalOnly = await structured(actors.super_admin, "orders_update_status", {
  id: fwd.id,
  status: "confirmed",
});
check("a forward move is offered for confirmation first", proposalOnly?.status === "CONFIRMATION_REQUIRED");
check("nothing changed on the proposal alone", (await orderRow(fwd.id)).data?.status === "pending");

const fwdRun = await confirmAndRun(actors.super_admin, "orders_update_status", {
  id: fwd.id,
  status: "confirmed",
});
check("the proposal names the order and both statuses", /pending/.test(fwdRun.proposal?.summary ?? "") && /confirmed/.test(fwdRun.proposal?.summary ?? ""));
check("the proposal warns that the customer is emailed", /customer/i.test(fwdRun.proposal?.summary ?? ""));
check("the confirmed move executes", fwdRun.executed?.status === "SUCCESS");
check("the order is now confirmed", (await orderRow(fwd.id)).data?.status === "confirmed");
check("the result reports the previous status", fwdRun.executed?.data?.previousStatus === "pending");

// Skipping is legal — a ready-to-wear piece never enters production.
const skip = await makeOrder("confirmed");
const skipRun = await confirmAndRun(actors.super_admin, "orders_update_status", {
  id: skip.id,
  status: "ready_to_ship",
});
check("a skipped stage is allowed", skipRun.executed?.status === "SUCCESS");
check("the skip landed", (await orderRow(skip.id)).data?.status === "ready_to_ship");

console.log("\n## Orders do not move backward");

const back = await makeOrder("shipped");
const backRes = await structured(actors.super_admin, "orders_update_status", {
  id: back.id,
  status: "pending",
});
check("a backward move is refused", backRes?.status === "FAILED");
check("the refusal is a business rule, not a validation error", backRes?.errorCode === "BUSINESS_RULE_ERROR");
check("the refusal names the legal next steps", /delivered/i.test(backRes?.message ?? ""));
check("the backward move changed nothing", (await orderRow(back.id)).data?.status === "shipped");
check("a backward move is refused BEFORE a confirmation is offered", backRes?.status !== "CONFIRMATION_REQUIRED");

const same = await makeOrder("confirmed");
check(
  "moving to the status it already has is refused",
  (await structured(actors.super_admin, "orders_update_status", { id: same.id, status: "confirmed" }))?.status ===
    "FAILED"
);

console.log("\n## Terminal states are terminal");

for (const terminal of ["delivered", "cancelled"]) {
  const order = await makeOrder(terminal);
  const res = await structured(actors.super_admin, "orders_update_status", {
    id: order.id,
    status: "shipped",
  });
  check(`a ${terminal} order cannot be reopened`, res?.status === "FAILED");
  check(`the ${terminal} order is untouched`, (await orderRow(order.id)).data?.status === terminal);
}

console.log("\n## Cancellation");

const cancellable = await makeOrder("confirmed");
const cancelRun = await confirmAndRun(actors.super_admin, "orders_cancel", {
  id: cancellable.id,
  reason: "Customer changed their mind.",
});
check("cancelling requires confirmation", cancelRun.proposal?.status === "CONFIRMATION_REQUIRED");
check("the proposal says no refund is issued", /refund/i.test(cancelRun.proposal?.summary ?? ""));
check("the confirmed cancellation executes", cancelRun.executed?.status === "SUCCESS");
check("the order is cancelled", (await orderRow(cancellable.id)).data?.status === "cancelled");

const shipped = await makeOrder("shipped");
const lateCancel = await structured(actors.super_admin, "orders_cancel", {
  id: shipped.id,
  reason: "Too late.",
});
check("a shipped order cannot be cancelled", lateCancel?.status === "FAILED");
check("the refusal explains it is a return", /return/i.test(lateCancel?.message ?? ""));
check("the shipped order is untouched", (await orderRow(shipped.id)).data?.status === "shipped");

const noReason = await makeOrder("pending");
check(
  "cancelling without a reason is refused",
  (await structured(actors.super_admin, "orders_cancel", { id: noReason.id }))?.errorCode === "VALIDATION_ERROR"
);

console.log("\n## The replay ledger still holds (Module 38's 0063)");

const replay = await makeOrder("confirmed");
const replayRun = await confirmAndRun(actors.super_admin, "orders_update_status", {
  id: replay.id,
  status: "in_production",
});
check("the first confirmed call succeeds", replayRun.executed?.status === "SUCCESS");
// The SAME arguments, deliberately. A token is bound to its action, so
// replaying it against a different status would be refused for the wrong
// reason — a signature mismatch, not a spent token. The ledger is what
// this asserts, and the dispatcher spends before it acts, so the second
// call never reaches the transition check.
const reused = await structured(actors.super_admin, "orders_update_status", {
  id: replay.id,
  status: "in_production",
  confirmationToken: replayRun.token,
});
check("the same token cannot be spent twice", reused?.status === "FAILED");
check("a spent token reads as a CONFLICT", reused?.errorCode === "CONFLICT");
check("the second action did not run", (await orderRow(replay.id)).data?.status === "in_production");

// =====================================================================
console.log("\n# Part D — production and QC");
// =====================================================================

console.log("\n## Advancing");

const job = await makeJob("cutting");
const advanced = await structured(actors.production, "production_advance_status", {
  id: job.id,
  status: "stitching",
});
check("production advances a job", advanced?.status === "SUCCESS");
check("the job moved", (await jobRow(job.id)).data?.current_status === "stitching");
check("advancing needs no confirmation — it is medium risk", advanced?.status !== "CONFIRMATION_REQUIRED");

const skipJob = await makeJob("materials_prepared");
check(
  "a skipped stage is allowed — not every piece has embroidery",
  (await structured(actors.production, "production_advance_status", { id: skipJob.id, status: "stitching" }))
    ?.status === "SUCCESS"
);

const backJob = await makeJob("finishing");
const backJobRes = await structured(actors.production, "production_advance_status", {
  id: backJob.id,
  status: "cutting",
});
check("work cannot be sent backward", backJobRes?.status === "FAILED");
check("the refusal calls it rework", /rework/i.test(backJobRes?.message ?? ""));
check("the job did not move", (await jobRow(backJob.id)).data?.current_status === "finishing");

const doneJob = await makeJob("delivered");
check(
  "a delivered job cannot be reopened",
  (await structured(actors.production, "production_advance_status", { id: doneJob.id, status: "shipped" }))
    ?.status === "FAILED"
);

console.log("\n## QC records without moving");

const qcJob = await makeJob("quality_check");
const qcFail = await structured(actors.qc, "production_record_qc", {
  id: qcJob.id,
  passed: false,
  note: "Hem uneven on the left panel.",
});
check("qc records a failed inspection", qcFail?.status === "SUCCESS");
check("recording a failure did NOT move the job", (await jobRow(qcJob.id)).data?.current_status === "quality_check");
check("the result says the job was not moved", qcFail?.data?.movedJob === false);

const { data: qcHistory } = await admin
  .from("production_status_history")
  .select("status, note")
  .eq("production_order_id", qcJob.id)
  .order("created_at", { ascending: false })
  .limit(1);
check("the finding is recorded in the history", /Hem uneven/.test(qcHistory?.[0]?.note ?? ""));
check("the history row records FAILED", /FAILED/.test(qcHistory?.[0]?.note ?? ""));
check("the history row sits at the job's current stage", qcHistory?.[0]?.status === "quality_check");

const qcPass = await makeJob("quality_check");
const passRes = await structured(actors.qc, "production_record_qc", {
  id: qcPass.id,
  passed: true,
  note: "All seams checked.",
});
check("qc records a pass", passRes?.status === "SUCCESS");
check("a pass does not advance the job either", (await jobRow(qcPass.id)).data?.current_status === "quality_check");
check(
  "a bare pass with no finding is refused",
  (await structured(actors.qc, "production_record_qc", { id: qcPass.id, passed: true }))?.errorCode ===
    "VALIDATION_ERROR"
);

console.log("\n## Production details — omission is not deletion");

const detailJob = await makeJob("cutting");
await admin
  .from("production_orders")
  .update({ assigned_team: "Atelier A", estimated_completion_date: "2026-12-01" })
  .eq("id", detailJob.id);

const detailRes = await structured(actors.production, "production_update_details", {
  id: detailJob.id,
  assignedTeam: "Atelier B",
});
check("a partial detail update succeeds", detailRes?.status === "SUCCESS");
const detailAfter = (await jobRow(detailJob.id)).data;
check("the field sent was changed", detailAfter?.assigned_team === "Atelier B");
check("the field NOT sent survived", detailAfter?.estimated_completion_date === "2026-12-01");

await structured(actors.production, "production_update_details", {
  id: detailJob.id,
  estimatedCompletionDate: null,
});
check(
  "an explicit null clears the field",
  (await jobRow(detailJob.id)).data?.estimated_completion_date === null
);
check(
  "an empty update is refused rather than silently succeeding",
  (await structured(actors.production, "production_update_details", { id: detailJob.id }))?.errorCode ===
    "VALIDATION_ERROR"
);
check(
  "a malformed date is a validation error, not a database error",
  (await structured(actors.production, "production_update_details", {
    id: detailJob.id,
    estimatedCompletionDate: "01/12/2026",
  }))?.errorCode === "VALIDATION_ERROR"
);

// =====================================================================
console.log("\n# Part E — enquiries");
// =====================================================================

const enq = await makeEnquiry("new");
check(
  "an enquiry moves forward",
  (await structured(actors.sales, "enquiries_update_status", { id: enq.id, status: "in_review" }))?.status ===
    "SUCCESS"
);
const backEnq = await makeEnquiry("quoted");
check(
  "an enquiry cannot move backward",
  (await structured(actors.sales, "enquiries_update_status", { id: backEnq.id, status: "new" }))?.status === "FAILED"
);
const closedEnq = await makeEnquiry("closed");
const reopen = await structured(actors.sales, "enquiries_update_status", {
  id: closedEnq.id,
  status: "in_review",
});
check("a closed enquiry cannot be reopened", reopen?.status === "FAILED");
check("the refusal suggests a new enquiry instead", /new enquiry/i.test(reopen?.message ?? ""));

// =====================================================================
console.log("\n# Part F — what the customer is and is not told");
// =====================================================================

const notified = await makeOrder("confirmed");
const { count: beforeNotify } = await admin
  .from("notifications")
  .select("id", { count: "exact", head: true })
  .eq("profile_id", actors.customer.id);
await confirmAndRun(actors.super_admin, "orders_update_status", {
  id: notified.id,
  status: "shipped",
  note: "Tracking to follow.",
});
const { count: afterNotify } = await admin
  .from("notifications")
  .select("id", { count: "exact", head: true })
  .eq("profile_id", actors.customer.id);
// Counted as a DELTA per customer: `notifications` has no entity_id
// column — the order is identified in the row's link, not a foreign key.
check("an order status change notifies the customer", (afterNotify ?? 0) > (beforeNotify ?? 0));
const { data: latestNotification } = await admin
  .from("notifications")
  .select("link")
  .eq("profile_id", actors.customer.id)
  .order("created_at", { ascending: false })
  .limit(1);
check("the notification links to the order that changed", (latestNotification?.[0]?.link ?? "").includes(notified.id));

const { data: timeline } = await admin
  .from("order_status_history")
  .select("status, note, changed_by")
  .eq("order_id", notified.id)
  .order("created_at", { ascending: false })
  .limit(1);
check("the change is on the customer's order timeline", timeline?.[0]?.status === "shipped");
check("the note reaches the timeline", timeline?.[0]?.note === "Tracking to follow.");
check("the timeline names who made the change", timeline?.[0]?.changed_by === actors.super_admin.id);

const quietJob = await makeJob("quality_check");
const { count: beforeQc } = await admin
  .from("notifications")
  .select("id", { count: "exact", head: true })
  .eq("profile_id", actors.customer.id);
await structured(actors.qc, "production_record_qc", {
  id: quietJob.id,
  passed: false,
  note: "Beading loose.",
});
const { count: afterQc } = await admin
  .from("notifications")
  .select("id", { count: "exact", head: true })
  .eq("profile_id", actors.customer.id);
check("a failed quality check does NOT notify the customer", (beforeQc ?? 0) === (afterQc ?? 0));

// ---- Internal notes --------------------------------------------------
console.log("\n## Internal notes stay internal");

const noteOrder = await makeOrder("confirmed");
const { count: beforeNote } = await admin
  .from("notifications")
  .select("id", { count: "exact", head: true })
  .eq("profile_id", actors.customer.id);
const noteRes = await structured(actors.sales, "orders_add_note", {
  id: noteOrder.id,
  note: "Customer prefers evening delivery.",
});
check("sales can add an internal note", noteRes?.status === "SUCCESS");
const { count: afterNote } = await admin
  .from("notifications")
  .select("id", { count: "exact", head: true })
  .eq("profile_id", actors.customer.id);
check("an internal note notifies nobody", (afterNote ?? 0) === (beforeNote ?? 0));
check(
  "an empty note is refused",
  (await structured(actors.sales, "orders_add_note", { id: noteOrder.id, note: "   " }))?.errorCode ===
    "VALIDATION_ERROR"
);

// ---- Audit -----------------------------------------------------------
console.log("\n## Audit (12B.7: every write is recorded)");

const { data: auditRows } = await admin
  .from("audit_logs")
  .select("action, entity_id, actor_id")
  .in("action", ["order.status_changed", "production.status_changed", "production.qc_recorded"])
  .order("created_at", { ascending: false })
  .limit(50);

check("an order status change is audited", auditRows?.some((r) => r.action === "order.status_changed"));
check(
  "a production stage change is audited — a gap this module closed",
  auditRows?.some((r) => r.action === "production.status_changed")
);
check("a quality check is audited", auditRows?.some((r) => r.action === "production.qc_recorded"));
check(
  "the audit row names the actor rather than nobody",
  auditRows?.some((r) => r.actor_id === actors.super_admin.id || r.actor_id === actors.qc.id)
);

// ---- Validation and leakage -----------------------------------------
console.log("\n## Validation and secret leakage");

check(
  "an unknown field is refused (schemas are strict)",
  (await structured(actors.super_admin, "orders_update_status", {
    id: fwd.id,
    status: "shipped",
    table: "profiles",
  }))?.errorCode === "VALIDATION_ERROR"
);
check(
  "a malformed uuid is a validation error, not a database error",
  (await structured(actors.super_admin, "orders_update_status", { id: "not-a-uuid", status: "shipped" }))
    ?.errorCode === "VALIDATION_ERROR"
);
check(
  "an unknown status is refused",
  (await structured(actors.super_admin, "orders_update_status", { id: fwd.id, status: "refunded" }))?.errorCode ===
    "VALIDATION_ERROR"
);
check(
  "a missing order is NOT_FOUND, not a silent success",
  (await structured(actors.super_admin, "orders_update_status", {
    id: "00000000-0000-0000-0000-000000000000",
    status: "shipped",
  }))?.errorCode === "NOT_FOUND"
);
check(
  "a missing production order is NOT_FOUND",
  (await structured(actors.production, "production_advance_status", {
    id: "00000000-0000-0000-0000-000000000000",
    status: "stitching",
  }))?.errorCode === "NOT_FOUND"
);

const everythingSeen = JSON.stringify([
  fwdRun,
  cancelRun,
  advanced,
  qcFail,
  detailRes,
  noteRes,
  reopen,
  backJobRes,
]);
check("no service-role key appears in any write result", !everythingSeen.includes(serviceKey));
check("no anon key appears in any write result", !everythingSeen.includes(anonKey));
check("no connection string appears in any write result", !/postgres(ql)?:\/\//.test(everythingSeen));
check(
  "no table name is echoed back to the caller",
  !/production_status_history|order_status_history|order_notes/.test(everythingSeen)
);

// ---- Cleanup ---------------------------------------------------------
await purgeDevtestData(admin);
for (const id of createdUsers) {
  await admin.auth.admin.deleteUser(id).catch(() => {});
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
