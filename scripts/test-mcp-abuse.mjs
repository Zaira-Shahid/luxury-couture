// Module 43 — abuse resistance and observability, asserted end to end.
//
// The other MCP suites prove the tools do the right thing when asked
// properly. This one asks improperly, and then checks that the system
// WROTE DOWN what happened — which is the half Module 43 adds and the
// half that was missing entirely: a refusal on a read tool used to be
// recorded nowhere, so "who was refused what, and when" had no answer
// after the request ended.
//
// Three rules it follows, inherited from test-security.mjs:
//
//  1. NOTHING DESTRUCTIVE. Every probe is a read, a refusal, or a write
//     this script made and then removes. No high-risk tool is driven to
//     completion — the confirmation gate is proven in test-mcp-write.mjs
//     against fixtures built for it, and re-driving it here would mutate
//     real records to re-prove someone else's assertion.
//  2. THE NEGATIVE HALF IS THE POINT. Asserting that a refusal happened
//     is half a test; the other half is that nothing was executed on the
//     way to refusing, and that the refusal left a trace.
//  3. A KNOWN-UNFIXED GAP FAILS rather than being quietly omitted.
//
//   node --env-file=.env.local scripts/test-mcp-abuse.mjs
//
// Requires a running PRODUCTION server (APP_URL, default localhost:3000).
import { spawnSync } from "node:child_process";
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

// =====================================================================
console.log("# Part A — the guarantees, read from the source");
// =====================================================================

const migration = readFileSync("supabase/migrations/0065_mcp_observability.sql", "utf8");
const auditSource = readFileSync("src/lib/mcp/audit.ts", "utf8");
const metricsSource = readFileSync("src/lib/mcp/metrics.ts", "utf8");
const routeSource = readFileSync("src/app/api/mcp/route.ts", "utf8");

// The tables are written by the dispatcher through the service-role
// client and by nothing else. A policy granting insert to anyone would
// let a caller forge or flood their own history; a delete policy would
// let the refused party erase the record of the refusal.
for (const table of ["mcp_tool_stats", "mcp_tool_failures"]) {
  const policies = migration.match(new RegExp(`on public\\.${table} for (\\w+)`, "g")) ?? [];
  check(
    `${table} grants nothing but select`,
    policies.length > 0 && policies.every((p) => p.endsWith("for select"))
  );
  check(`${table} has RLS enabled`, migration.includes(`alter table public.${table} enable row level security`));
  check(
    `${table} is read-gated on settings.manage`,
    migration.includes(`public.has_permission('settings.manage')`)
  );
}

// The increment is SECURITY DEFINER because the table has no insert
// policy — so execute has to be taken away from everyone who could
// otherwise inflate a counter, and given back to service_role by name.
// 0058/0059 is the precedent: `revoke from public` also strips what
// service_role inherits, so the grant cannot be left implicit.
check(
  "the increment RPC is security definer",
  /create or replace function public\.record_mcp_tool_call[\s\S]*?security definer/.test(migration)
);
check(
  "execute on the increment RPC is revoked from authenticated",
  /revoke execute on function public\.record_mcp_tool_call[\s\S]*?authenticated/.test(migration)
);
check(
  "execute on the increment RPC is granted to service_role",
  /grant execute on function public\.record_mcp_tool_call[\s\S]*?to service_role/.test(migration)
);
// One statement, so two concurrent calls in the same hour cannot both
// read the same count and write it plus one.
check(
  "the counter is incremented by on-conflict, not read-then-write",
  migration.includes("on conflict (tool_name, hour) do update set")
);

// The bug this module fixes: metrics must be recorded BEFORE the early
// return that skips non-write tools, or a refused read is dropped again.
const metricsAt = auditSource.indexOf("recordToolMetrics(params)");
const earlyReturnAt = auditSource.indexOf('if (tool.kind !== "write") return;');
check("metrics are recorded for every call", metricsAt !== -1);
check(
  "metrics are recorded BEFORE the write-only early return",
  metricsAt !== -1 && earlyReturnAt !== -1 && metricsAt < earlyReturnAt
);

// A failure row carries the arguments, so it must carry them redacted.
check("failure rows redact their input", metricsSource.includes("redactInput(params.input)"));
// An observability write must never be able to fail the call it measures.
check("the metrics writer swallows its own errors", /catch \(error\) \{[\s\S]*?logger\.warn/.test(metricsSource));
check("a throttled request is recorded", routeSource.includes("recordRateLimited("));
check("an oversized body is refused before it is parsed", routeSource.includes("MAX_BODY_BYTES"));

// =====================================================================
console.log("\n# Part B — the live endpoint, asked improperly");
// =====================================================================

const suffix = Date.now();
const createdUsers = [];
await purgeDevtestData(admin);

// `label` separates two accounts that share a role: the flood probe
// needs its own marketing account, or it would exhaust the window of the
// one every other check is using.
async function actor(role, label = role) {
  const email = `m43-${label}-${suffix}@luxury-couture-devtest.local`;
  const password = `m43-test-${label}-${suffix}`;
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
  customer: await actor("customer"),
  // Its own account, because the rate-limit probe deliberately exhausts
  // the window and would otherwise throttle every check after it.
  flooder: await actor("marketing", "flooder"),
};

async function post(who, body, { raw = null, headers: extra = {} } = {}) {
  const headers = { "content-type": "application/json", ...extra };
  if (who) headers.authorization = `Bearer ${who.session.access_token}`;
  const res = await fetch(`${APP_URL}/api/mcp`, {
    method: "POST",
    headers,
    body: raw ?? JSON.stringify(body),
  });
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
  post(who, { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } });

const structured = (res) => res.json?.result?.structuredContent ?? null;

/** Failure rows this run wrote for one actor, newest first. */
async function failuresFor(actorId) {
  const { data } = await admin
    .from("mcp_tool_failures")
    .select("tool_name, error_code, input, actor_role")
    .eq("actor_id", actorId)
    .order("occurred_at", { ascending: false })
    .limit(50);
  return data ?? [];
}

// ---- Who gets in at all ----------------------------------------------
console.log("\n## The door");

const anonymous = await post(null, { jsonrpc: "2.0", id: 1, method: "initialize" });
check("an anonymous caller is refused", anonymous.status === 401);
check(
  "the refusal names no capability",
  !anonymous.text.includes("orders") && !anonymous.text.includes("permission")
);

const anonList = await post(null, { jsonrpc: "2.0", id: 1, method: "tools/list" });
check("an anonymous caller cannot enumerate tools", anonList.status === 401 && !anonList.text.includes("system_ping"));

const asCustomer = await post(actors.customer, { jsonrpc: "2.0", id: 1, method: "tools/list" });
check("a customer account reaches no tool", asCustomer.status === 403);

const forgedBearer = await post(null, { jsonrpc: "2.0", id: 1, method: "ping" }, {
  headers: { authorization: "Bearer not-a-real-token" },
});
check("a forged bearer token is refused", forgedBearer.status === 401);

// ---- Malformed and oversized ----------------------------------------
console.log("\n## Malformed input");

const badJson = await post(actors.super_admin, null, { raw: "{ not json" });
check("malformed JSON is a clean parse error", badJson.status === 400);

const batch = await post(actors.super_admin, [{ jsonrpc: "2.0", id: 1, method: "ping" }]);
check("a batch request is refused rather than half-processed", batch.status === 400);

const notRpc = await post(actors.super_admin, { hello: "world" });
check("a non-JSON-RPC body is refused", notRpc.status === 400);

const unknownMethod = await post(actors.super_admin, { jsonrpc: "2.0", id: 1, method: "tools/delete" });
check("an unknown method is METHOD_NOT_FOUND", unknownMethod.json?.error?.code === -32601);

const unknownTool = await call(actors.super_admin, "orders_drop_table");
check("an unknown tool name is refused", unknownTool.json?.error?.code === -32602);
check("the refusal does not list what does exist", !unknownTool.text.includes("system_ping"));

// A megabyte of padding, declared honestly in content-length. The route
// must refuse before request.json() buffers it.
const huge = "x".repeat(1024 * 1024);
const oversized = await post(actors.super_admin, null, {
  raw: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "system_ping", arguments: { pad: huge } } }),
});
check("an oversized body is refused with 413", oversized.status === 413);

// Deep nesting: the schema is .strict(), so this is a validation error
// rather than something that reaches a query builder.
let nested = { deep: 1 };
for (let i = 0; i < 200; i += 1) nested = { deep: nested };
const deep = await call(actors.super_admin, "system_ping", nested);
check("a deeply nested argument object is rejected by the schema", structured(deep)?.status === "FAILED");

const wrongType = await call(actors.super_admin, "orders_get", { id: 12345 });
check("a wrong-typed argument is a validation error", structured(wrongType)?.errorCode === "VALIDATION_ERROR");

const sqlish = await call(actors.super_admin, "orders_get", { id: "1'; drop table orders; --" });
check("a SQL-shaped id never leaves the schema", structured(sqlish)?.errorCode === "VALIDATION_ERROR");

// ---- The refusal leaves a trace --------------------------------------
console.log("\n## Refusals are recorded (the Module 43 change)");

// A read tool the marketing account has no key for. Before this module
// this refusal was persisted nowhere at all.
const refused = await call(actors.marketing, "orders_list", {});
check("a read tool refuses an account without its permission", structured(refused)?.errorCode === "FORBIDDEN");

const marketingFailures = await failuresFor(actors.marketing.id);
check(
  "the READ refusal was persisted",
  marketingFailures.some((row) => row.tool_name === "orders_list" && row.error_code === "FORBIDDEN")
);
check(
  "the persisted refusal names the role that was refused",
  marketingFailures.some((row) => row.actor_role === "marketing")
);

const validationRow = (await failuresFor(actors.super_admin.id)).find(
  (row) => row.tool_name === "orders_get" && row.error_code === "VALIDATION_ERROR"
);
check("a validation failure is persisted too", !!validationRow);
check(
  "the persisted arguments are the ones that were sent",
  JSON.stringify(validationRow?.input ?? {}).includes("drop table") ||
    JSON.stringify(validationRow?.input ?? {}).includes("12345")
);

// An unknown tool never reaches the dispatcher, so there is nothing to
// attribute a failure to. Recording one under a name that does not exist
// would put a tool in the metrics that the registry has never held.
check(
  "an unknown tool name writes no failure row",
  !(await failuresFor(actors.super_admin.id)).some((row) => row.tool_name === "orders_drop_table")
);

// ---- Successes are counted, not stored -------------------------------
console.log("\n## Successes are counted, not stored");

const before = await admin
  .from("mcp_tool_stats")
  .select("calls")
  .eq("tool_name", "system_ping")
  .gte("hour", new Date(Date.now() - 60 * 60 * 1000).toISOString());
const beforeCalls = (before.data ?? []).reduce((sum, row) => sum + Number(row.calls), 0);

// Counted first: the malformed-input probes above deliberately failed a
// system_ping, so "no failure rows for this tool" would be false for a
// reason that has nothing to do with these three calls.
const failuresBefore = (await failuresFor(actors.super_admin.id)).filter(
  (row) => row.tool_name === "system_ping"
).length;

const PINGS = 3;
for (let i = 0; i < PINGS; i += 1) await call(actors.super_admin, "system_ping", {});

const after = await admin
  .from("mcp_tool_stats")
  .select("calls, failures")
  .eq("tool_name", "system_ping")
  .gte("hour", new Date(Date.now() - 60 * 60 * 1000).toISOString());
const afterCalls = (after.data ?? []).reduce((sum, row) => sum + Number(row.calls), 0);

check("a successful call increments the counter", afterCalls >= beforeCalls + PINGS);
const failuresAfter = (await failuresFor(actors.super_admin.id)).filter(
  (row) => row.tool_name === "system_ping"
).length;
check("a successful call writes no failure row", failuresAfter === failuresBefore);

// The whole reason reads are counted rather than stored: three calls
// must not be three rows.
// At most two rows, and only two if the run straddled an hour boundary.
const pingRows = (after.data ?? []).length;
check("three calls did not become three rows", pingRows <= 2);

// ---- Rate limiting ---------------------------------------------------
console.log("\n## Rate limiting");

// The window is 60 per 10 minutes per ACTOR. Its own account, so the
// exhausted window belongs to nobody else.
let throttledAt = null;
for (let i = 0; i < 75 && throttledAt === null; i += 1) {
  const res = await call(actors.flooder, "system_ping", {});
  if (res.status === 429) throttledAt = i + 1;
}
check("a runaway loop is throttled", throttledAt !== null);
check("the throttle allows a normal conversation first", throttledAt === null || throttledAt > 20);

const flooderFailures = await failuresFor(actors.flooder.id);
check(
  "the throttled request was recorded",
  flooderFailures.some((row) => row.error_code === "RATE_LIMITED")
);
check(
  "the throttle names the tool that was being hammered",
  flooderFailures.some((row) => row.error_code === "RATE_LIMITED" && row.tool_name === "system_ping")
);

// Throttling one account must not touch another's window.
const otherStillWorks = await call(actors.super_admin, "system_ping", {});
check("one account's throttle does not limit another", structured(otherStillWorks)?.status === "SUCCESS");

// ---- Nothing leaks in any of the above -------------------------------
console.log("\n## Leakage");

const everything = [
  anonymous.text,
  asCustomer.text,
  refused.text,
  unknownTool.text,
  wrongType.text,
  deep.text,
].join("\n");
check("no service-role key appears in any refusal", !everything.includes(serviceKey));
check("no anon key appears in any refusal", !everything.includes(anonKey));
check("no connection string appears in any refusal", !/postgres(ql)?:\/\//.test(everything));
check("no Postgres error code reaches the caller", !/\b(42501|22P02|PGRST\d+)\b/.test(everything));

// ---- Load ------------------------------------------------------------
console.log("\n## Load (measured, not asserted)");

// Concurrency against a single cheap tool. This is a smoke measurement
// on one developer machine, not a benchmark: it exists so a change that
// makes every call five times slower is noticed, and it is printed
// rather than asserted because a threshold tuned on this laptop would
// fail on someone else's for no reason.
const CONCURRENCY = 10;
const loadActor = actors.super_admin;
const started = Date.now();
const timings = await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    const t0 = Date.now();
    const res = await call(loadActor, "system_ping", {});
    return { ms: Date.now() - t0, status: res.status };
  })
);
const wall = Date.now() - started;
const sorted = timings.map((t) => t.ms).sort((a, b) => a - b);
const p50 = sorted[Math.floor(sorted.length * 0.5)];
const p95 = sorted[Math.max(0, Math.floor(sorted.length * 0.95) - 1)];
console.log(
  `      ${CONCURRENCY} concurrent system_ping — p50 ${p50}ms, p95 ${p95}ms, wall ${wall}ms, ` +
    `${timings.filter((t) => t.status === 200).length}/${CONCURRENCY} answered`
);
// The one thing worth asserting: concurrency must not produce errors.
// Some of these may be 429s if the window was already tight, which is a
// refusal rather than a fault — both are answers, and a 500 is not.
check("no call under concurrency returned a server error", timings.every((t) => t.status < 500));

// =====================================================================
console.log("\n# Part C — the stdio transport");
// =====================================================================

const stdioSource = readFileSync("scripts/mcp-stdio.mjs", "utf8");

// The design claim, asserted rather than trusted: this is a pipe to the
// route, not a second server. If it ever imports the registry or the
// dispatcher, it has become a second execution path with its own copy of
// authentication and audit, and this check is what should stop that.
check("the adapter imports no registry", !/from ["'].*mcp\/(registry|tools|server)/.test(stdioSource));
check("the adapter talks to the endpoint over HTTP", stdioSource.includes("/api/mcp") || stdioSource.includes("MCP_URL"));
check("the adapter sends a bearer token", stdioSource.includes("Bearer ${token}"));

// Without a token there is nothing to act as, and starting anyway would
// mean a client that appears connected and refuses every call.
const noToken = spawnSync(process.execPath, ["scripts/mcp-stdio.mjs"], {
  input: "",
  encoding: "utf8",
  env: { ...process.env, MCP_ACCESS_TOKEN: "" },
});
check("the adapter refuses to start without a token", noToken.status === 1);
check("the token is not required on stdout", (noToken.stdout ?? "") === "");

// End to end: a real tools/list through the pipe, for a real account.
const stdioRun = spawnSync(
  process.execPath,
  ["scripts/mcp-stdio.mjs"],
  {
    input:
      JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }) +
      "\n" +
      // A notification: the endpoint answers 202 with no body, and the
      // adapter must write nothing at all for it.
      JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) +
      "\n",
    encoding: "utf8",
    env: {
      ...process.env,
      MCP_URL: `${APP_URL}/api/mcp`,
      MCP_ACCESS_TOKEN: actors.super_admin.session.access_token,
    },
  }
);

const stdioLines = (stdioRun.stdout ?? "").trim().split("\n").filter(Boolean);
check("the adapter returned exactly one reply for one request", stdioLines.length === 1);

let stdioReply = null;
try {
  stdioReply = JSON.parse(stdioLines[0] ?? "null");
} catch {
  /* left null — the next check fails on it */
}
check("the adapter proxied tools/list", Array.isArray(stdioReply?.result?.tools));
check(
  "the tools it returned are the registry's own",
  (stdioReply?.result?.tools ?? []).some((tool) => tool.name === "system_ping")
);
check("a notification produced no output", stdioLines.length === 1);

// ---- Cleanup ---------------------------------------------------------
// The failure rows this script wrote are left in place deliberately: the
// actor rows are deleted, so `actor_id` goes null (0065's `on delete set
// null`) and what remains is an anonymous count of refusals. Deleting
// them would mean this script needs delete rights on a table whose whole
// design is that nothing can delete from it.
for (const id of createdUsers) await admin.auth.admin.deleteUser(id);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
