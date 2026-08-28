// Module 36 — the MCP foundation.
//
// Two halves, and the second one is the point.
//
// PART A is unit work against the modules that can be imported directly
// (protocol, registry, confirmation tokens, redaction, result envelopes) —
// the invariants that must hold before a request ever arrives.
//
// PART B drives the real /api/mcp endpoint over HTTP with REAL signed-in
// accounts of different roles, and most of its checks are negative: an
// anonymous caller refused, a customer refused, a production account
// refused a tool it was never even shown, and every shape of "give the AI
// arbitrary access" the Master Build Plan forbids (section 12B.15) coming
// back as an unknown tool. A permission layer that grants correctly but
// revokes nothing reads as protection while providing none, so the
// revocations are tested at least as hard as the grants — the same
// standard Module 26 set.
//
//   node --env-file=.env.local scripts/test-mcp.mjs
//
// Requires a running server (APP_URL, default http://localhost:3000).
import { createClient } from "@supabase/supabase-js";

import { purgeDevtestData } from "./lib/purge-devtest.mjs";

import {
  isNotification,
  parseJsonRpcRequest,
  MCP_PROTOCOL_VERSION,
} from "../src/lib/mcp/protocol.ts";
import { buildRegistry, describeTool } from "../src/lib/mcp/registry.ts";
import {
  canonicalize,
  createConfirmationToken,
  verifyConfirmationToken,
} from "../src/lib/mcp/confirm.ts";
import { redactInput } from "../src/lib/mcp/redact.ts";
import { confirmationResult, errorResult, successResult } from "../src/lib/mcp/result.ts";
import { z } from "zod";

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

// =====================================================================
console.log("# Part A — protocol parsing");
// =====================================================================

check(
  "a well-formed request parses",
  parseJsonRpcRequest({ jsonrpc: "2.0", id: 1, method: "tools/list" })?.method === "tools/list"
);
check("a wrong jsonrpc version is rejected", parseJsonRpcRequest({ jsonrpc: "1.0", id: 1, method: "x" }) === null);
check("a missing method is rejected", parseJsonRpcRequest({ jsonrpc: "2.0", id: 1 }) === null);
check("a non-string method is rejected", parseJsonRpcRequest({ jsonrpc: "2.0", id: 1, method: 5 }) === null);
check("an array id is rejected", parseJsonRpcRequest({ jsonrpc: "2.0", id: [1], method: "x" }) === null);
check("array params are rejected", parseJsonRpcRequest({ jsonrpc: "2.0", id: 1, method: "x", params: [] }) === null);
check("a bare array is rejected", parseJsonRpcRequest([{ jsonrpc: "2.0", method: "x" }]) === null);
check("null is rejected", parseJsonRpcRequest(null) === null);
check(
  "a request without an id is a notification",
  isNotification(parseJsonRpcRequest({ jsonrpc: "2.0", method: "notifications/initialized" }))
);
check(
  "a request with id 0 is NOT a notification",
  !isNotification(parseJsonRpcRequest({ jsonrpc: "2.0", id: 0, method: "ping" }))
);
// id: null is a legal JSON-RPC id and must not be mistaken for absent —
// the difference decides whether the caller gets a response at all.
check(
  "a request with a null id is NOT a notification",
  !isNotification(parseJsonRpcRequest({ jsonrpc: "2.0", id: null, method: "ping" }))
);

// =====================================================================
console.log("\n# Part A — registry invariants (enforced at build time)");
// =====================================================================

const okTool = {
  name: "demo_list",
  title: "Demo",
  description: "A demo read tool.",
  kind: "read",
  risk: "low",
  permission: null,
  inputSchema: z.object({}).strict(),
  handler: async () => ({ action: "Demo", data: {} }),
};

function rejects(label, tool) {
  let threw = false;
  try {
    buildRegistry([tool]);
  } catch {
    threw = true;
  }
  check(label, threw);
}

check("a valid tool registers", buildRegistry([okTool]).all().length === 1);
rejects("a camelCase tool name is refused", { ...okTool, name: "demoList" });
rejects("a single-word tool name is refused", { ...okTool, name: "demo" });
rejects("a name with a hyphen is refused", { ...okTool, name: "demo-list" });
rejects("an empty description is refused", { ...okTool, description: "  " });
// The three rules that carry security weight.
rejects("a write tool with no permission is refused", {
  ...okTool,
  name: "demo_update",
  kind: "write",
  permission: null,
});
rejects("a high-risk READ tool is refused", { ...okTool, risk: "high" });
rejects("a high-risk tool with no describeImpact is refused", {
  ...okTool,
  name: "demo_delete",
  kind: "write",
  risk: "high",
  permission: "catalog.write",
});
let duplicateThrew = false;
try {
  buildRegistry([okTool, { ...okTool }]);
} catch {
  duplicateThrew = true;
}
check("a duplicate tool name is refused", duplicateThrew);

const gated = {
  ...okTool,
  name: "demo_secret",
  permission: "settings.manage",
};
const registry = buildRegistry([okTool, gated]);
check("visibleTo hides a tool the caller lacks the permission for", registry.visibleTo(new Set()).length === 1);
check(
  "visibleTo shows it once the permission is held",
  registry.visibleTo(new Set(["settings.manage"])).length === 2
);
check("get() still resolves a tool the caller cannot see", !!registry.get("demo_secret"));

const described = describeTool(gated);
check("describeTool emits a JSON Schema generated from the Zod schema", described.inputSchema?.type === "object");
check("describeTool reports kind and risk in _meta", described._meta.kind === "read" && described._meta.risk === "low");
check("describeTool marks a read tool readOnlyHint", described.annotations.readOnlyHint === true);

// =====================================================================
console.log("\n# Part A — confirmation tokens for high-risk actions");
// =====================================================================

// The signing secret comes from the environment, exactly as in production.
const subject = { toolName: "products_archive", args: { ids: ["a", "b"] }, actorId: "actor-1" };
const token = createConfirmationToken(subject);

check("a fresh token verifies for the same action", verifyConfirmationToken(token, subject).valid);
check(
  "a token does NOT verify for different arguments",
  !verifyConfirmationToken(token, { ...subject, args: { ids: ["a", "b", "c"] } }).valid
);
check(
  "a token does NOT verify for a different tool",
  !verifyConfirmationToken(token, { ...subject, toolName: "products_delete" }).valid
);
check(
  "a token does NOT verify for a different actor",
  !verifyConfirmationToken(token, { ...subject, actorId: "actor-2" }).valid
);
check(
  "an expired token is refused and reports why",
  verifyConfirmationToken(token, subject, Date.now() + 6 * 60 * 1000).reason === "expired"
);
check("a malformed token is refused", !verifyConfirmationToken("nonsense", subject).valid);
check("an empty token is refused", !verifyConfirmationToken("", subject).valid);
check(
  "a forged signature is refused",
  !verifyConfirmationToken(`${Date.now() + 60000}.notasignature`, subject).valid
);
// Key order must not matter, or a client that serialises differently would
// have its own valid token rejected.
check(
  "canonicalize is key-order independent",
  canonicalize({ a: 1, b: 2 }) === canonicalize({ b: 2, a: 1 })
);
check("canonicalize distinguishes different values", canonicalize({ a: 1 }) !== canonicalize({ a: 2 }));
check(
  "a token issued for one argument order verifies against the other",
  verifyConfirmationToken(createConfirmationToken({ ...subject, args: { x: 1, y: 2 } }), {
    ...subject,
    args: { y: 2, x: 1 },
  }).valid
);

// =====================================================================
console.log("\n# Part A — audit redaction");
// =====================================================================

const redacted = redactInput({
  name: "Royal Rose",
  password: "hunter2",
  apiKey: "sk-live-123",
  API_KEY: "sk-live-456",
  authorization: "Bearer abc",
  nested: { secret: "s3cret", keep: "visible" },
});
check("a plain field survives redaction", redacted.name === "Royal Rose");
check("a password is redacted", redacted.password === "[redacted]");
check("an apiKey is redacted", redacted.apiKey === "[redacted]");
check("redaction is case-insensitive", redacted.API_KEY === "[redacted]");
check("an authorization header value is redacted", redacted.authorization === "[redacted]");
check("a nested secret is redacted", redacted.nested.secret === "[redacted]");
check("a nested non-secret survives", redacted.nested.keep === "visible");
check("a long string is truncated", redactInput("x".repeat(500)).includes("(500 chars)"));
check("a long array is capped", redactInput(Array.from({ length: 50 }, (_, i) => i)).length === 21);
check("deep nesting is capped", redactInput({ a: { b: { c: { d: { e: { f: 1 } } } } } }).a.b.c.d.e === "[redacted]");

// =====================================================================
console.log("\n# Part A — result envelopes");
// =====================================================================

const ok = successResult({ action: "Product updated", data: { id: "p1" }, target: { type: "product", id: "p1" } });
check("a success envelope reports SUCCESS", ok.structuredContent.status === "SUCCESS");
check("a success envelope is not flagged as an error", ok.isError === undefined);
check("a success envelope names the record", ok.content[0].text.includes("product p1"));

const bad = errorResult({ code: "NOT_FOUND", message: "That record could not be found." }, "Product update");
check("a failure envelope reports FAILED", bad.structuredContent.status === "FAILED");
check("a failure envelope sets isError", bad.isError === true);
check("a failure envelope carries the error code", bad.structuredContent.errorCode === "NOT_FOUND");
// The sentence an admin most needs after a failed write.
check("a failure envelope states that nothing changed", bad.content[0].text.includes("No changes were made."));

const pending = confirmationResult({
  action: "Bulk archive products",
  summary: "This will permanently archive 24 products.",
  affectedRecords: 24,
  confirmationToken: "t",
  expiresInSeconds: 300,
});
check("a confirmation envelope reports CONFIRMATION_REQUIRED", pending.structuredContent.status === "CONFIRMATION_REQUIRED");
check("a confirmation envelope states the affected record count", pending.content[0].text.includes("Affected records: 24"));
check("a confirmation envelope is not an error", pending.isError === undefined);
check("a confirmation envelope says nothing has changed yet", pending.content[0].text.includes("Nothing has changed yet"));

// =====================================================================
console.log("\n# Part B — the live endpoint, with real accounts");
// =====================================================================

const suffix = Date.now();
const createdUsers = [];
await purgeDevtestData(admin);

async function actor(role) {
  const email = `mcp-${role}-${suffix}@luxury-couture-devtest.local`;
  const password = `mcp-test-${role}-${suffix}`;
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
  admin: await actor("admin"),
  production: await actor("production"),
  customer: await actor("customer"),
};

/** Matches @supabase/ssr's cookie format — the same helper test-permissions.mjs uses. */
function sessionCookie(session) {
  const ref = new URL(url).hostname.split(".")[0];
  return `sb-${ref}-auth-token=base64-${Buffer.from(JSON.stringify(session), "utf8").toString("base64url")}`;
}

/** Calls the endpoint as `who`, over the Bearer transport unless asked for cookies. */
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

// ---- Authentication --------------------------------------------------
console.log("\n## Authentication");

const anonymous = await rpc(null, { jsonrpc: "2.0", id: 1, method: "tools/list" });
check("an anonymous caller is refused with 401", anonymous.status === 401);
check("the refusal carries the UNAUTHORIZED code", anonymous.json?.error?.data?.code === "UNAUTHORIZED");
check("an anonymous caller is told nothing about the tools", !anonymous.text.includes("system_ping"));

const anonInit = await rpc(null, { jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
check("even initialize requires a session", anonInit.status === 401);

const badToken = await fetch(`${APP_URL}/api/mcp`, {
  method: "POST",
  headers: { "content-type": "application/json", authorization: "Bearer not-a-real-token" },
  body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
});
check("a forged bearer token is refused", badToken.status === 401);

const getRes = await fetch(`${APP_URL}/api/mcp`);
check("GET is refused with 405", getRes.status === 405);

// ---- Role gate -------------------------------------------------------
console.log("\n## The role gate");

const asCustomer = await rpc(actors.customer, { jsonrpc: "2.0", id: 1, method: "tools/list" });
check("a customer is refused with 403", asCustomer.status === 403);
check("the customer refusal carries the FORBIDDEN code", asCustomer.json?.error?.data?.code === "FORBIDDEN");
const customerPing = await call(actors.customer, "system_ping");
check("a customer cannot call a tool either", customerPing.status === 403);

// ---- Protocol over HTTP ---------------------------------------------
console.log("\n## Protocol");

const init = await rpc(actors.admin, {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: { protocolVersion: MCP_PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: "suite", version: "1" } },
});
check("initialize succeeds for an admin", init.status === 200 && !!init.json?.result);
check("initialize echoes the negotiated protocol version", init.json.result.protocolVersion === MCP_PROTOCOL_VERSION);
check("initialize identifies the server", init.json.result.serverInfo?.name === "luxury-couture-mcp");
check("the server advertises tools capability", !!init.json.result.capabilities?.tools);

const oldVersion = await rpc(actors.admin, {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: { protocolVersion: "1999-01-01" },
});
check(
  "an unknown protocol version is answered with ours",
  oldVersion.json.result.protocolVersion === MCP_PROTOCOL_VERSION
);

const notification = await rpc(actors.admin, { jsonrpc: "2.0", method: "notifications/initialized" });
check("a notification gets 202 and no body", notification.status === 202 && notification.text === "");

const pingRpc = await rpc(actors.admin, { jsonrpc: "2.0", id: 7, method: "ping" });
check("ping succeeds and echoes the id", pingRpc.json?.id === 7);

const unknownMethod = await rpc(actors.admin, { jsonrpc: "2.0", id: 1, method: "resources/list" });
check("an unsupported method returns METHOD_NOT_FOUND", unknownMethod.json?.error?.code === -32601);

const badJson = await fetch(`${APP_URL}/api/mcp`, {
  method: "POST",
  headers: { "content-type": "application/json", authorization: `Bearer ${actors.admin.session.access_token}` },
  body: "{ not json",
});
check("malformed JSON returns a parse error", badJson.status === 400);

const batch = await rpc(actors.admin, [{ jsonrpc: "2.0", id: 1, method: "ping" }]);
check("a batch request is refused rather than half-processed", batch.status === 400);

const notRpc = await rpc(actors.admin, { hello: "world" });
check("a non-JSON-RPC body is refused", notRpc.status === 400);

// ---- Tool listing and calling ---------------------------------------
console.log("\n## Tools");

const adminList = await rpc(actors.admin, { jsonrpc: "2.0", id: 1, method: "tools/list" });
const adminToolNames = (adminList.json?.result?.tools ?? []).map((t) => t.name);
check("an admin sees system_ping", adminToolNames.includes("system_ping"));
check("an admin sees system_whoami", adminToolNames.includes("system_whoami"));
check("an admin sees system_diagnostics", adminToolNames.includes("system_diagnostics"));
check(
  "every listed tool advertises an input schema",
  (adminList.json?.result?.tools ?? []).every((t) => t.inputSchema?.type === "object")
);
check(
  "every listed tool declares its kind and risk",
  (adminList.json?.result?.tools ?? []).every((t) => t._meta?.kind && t._meta?.risk)
);

const pingCall = await call(actors.admin, "system_ping");
check("system_ping succeeds", pingCall.json?.result?.structuredContent?.status === "SUCCESS");
check("system_ping reports the protocol version", pingCall.json.result.structuredContent.data.protocolVersion === MCP_PROTOCOL_VERSION);

const whoami = await call(actors.admin, "system_whoami");
check("system_whoami reports the caller's own id", whoami.json?.result?.structuredContent?.data?.userId === actors.admin.id);
check("system_whoami reports the caller's real role", whoami.json.result.structuredContent.data.role === "admin");
check(
  "system_whoami reports permissions read from the database",
  Array.isArray(whoami.json.result.structuredContent.data.permissions) &&
    whoami.json.result.structuredContent.data.permissions.includes("catalog.write")
);

// The cookie transport is what the Module 42 admin chat will use, so it is
// verified rather than assumed.
const whoamiCookie = await call(actors.admin, "system_whoami", {}, { transport: "cookie" });
check(
  "the cookie transport resolves the same actor as the bearer transport",
  whoamiCookie.json?.result?.structuredContent?.data?.userId === actors.admin.id
);

const superWhoami = await call(actors.super_admin, "system_whoami");
check("super_admin resolves as super_admin", superWhoami.json?.result?.structuredContent?.data?.role === "super_admin");

// ---- Authorization, the negative half -------------------------------
console.log("\n## Authorization (the negative half)");

const prodList = await rpc(actors.production, { jsonrpc: "2.0", id: 1, method: "tools/list" });
const prodToolNames = (prodList.json?.result?.tools ?? []).map((t) => t.name);
check("a production account still sees system_ping", prodToolNames.includes("system_ping"));
check(
  "a production account is NOT shown system_diagnostics",
  !prodToolNames.includes("system_diagnostics")
);

// THE CHECK THIS MODULE EXISTS FOR: hiding a tool is not the enforcement.
// A client can call a name it was never shown, so the call itself must be
// refused — the same principle as "never rely only on hiding UI buttons".
const prodDiag = await call(actors.production, "system_diagnostics");
check(
  "a production account calling the unlisted tool anyway is REFUSED",
  prodDiag.json?.result?.structuredContent?.status === "FAILED"
);
check(
  "the refusal is FORBIDDEN, not an internal error",
  prodDiag.json?.result?.structuredContent?.errorCode === "FORBIDDEN"
);
check("the refusal is flagged as an error result", prodDiag.json?.result?.isError === true);
check("the refusal states that nothing changed", prodDiag.json.result.content[0].text.includes("No changes were made."));

const adminDiag = await call(actors.super_admin, "system_diagnostics");
check(
  "super_admin, which holds settings.manage, is allowed through",
  adminDiag.json?.result?.structuredContent?.status === "SUCCESS"
);
check(
  "diagnostics reports the registry contents",
  adminDiag.json.result.structuredContent.data.registry.total === 3
);
check(
  "diagnostics reports integrations as booleans only",
  ["boolean"].includes(typeof adminDiag.json.result.structuredContent.data.integrations.stripe)
);

// ---- Input validation ------------------------------------------------
console.log("\n## Input validation");

const unexpectedArg = await call(actors.admin, "system_ping", { table: "profiles" });
check(
  "an unexpected argument is rejected by the schema",
  unexpectedArg.json?.result?.structuredContent?.errorCode === "VALIDATION_ERROR"
);
// Zod's human-readable message is genericised to "Invalid input" by the
// production bundler, so the offending field has to reach the caller as
// STRUCTURED data or an assistant cannot correct itself.
check(
  "the validation error names the offending field",
  JSON.stringify(unexpectedArg.json.result.structuredContent.details ?? []).includes("table")
);
check(
  "the validation error carries a machine-readable issue code",
  (unexpectedArg.json.result.structuredContent.details ?? []).every((d) => !!d.code)
);

const unknownTool = await call(actors.admin, "definitely_not_a_tool");
check("an unknown tool is a protocol error", unknownTool.json?.error?.code === -32602);
check("the unknown-tool error does not enumerate the real tools", !unknownTool.text.includes("system_whoami"));

const noName = await rpc(actors.admin, { jsonrpc: "2.0", id: 1, method: "tools/call", params: {} });
check("a tools/call with no tool name is refused", noName.json?.error?.code === -32602);

// ---- The forbidden capabilities (section 12B.15) ---------------------
console.log("\n## Capabilities the AI must never have");

for (const forbidden of [
  "execute_sql",
  "sql_query",
  "query",
  "run_sql",
  "shell",
  "exec",
  "run_command",
  "read_file",
  "write_file",
  "fetch_url",
  "get_env",
  "supabase_query",
]) {
  const attempt = await call(actors.super_admin, forbidden, { sql: "select * from profiles" });
  check(`"${forbidden}" does not exist, even for super_admin`, attempt.json?.error?.code === -32602);
}

// A registered tool cannot be steered at another table either: the schemas
// are strict, so there is no argument through which a table name travels.
const steered = await call(actors.super_admin, "system_whoami", { userId: actors.admin.id });
check(
  "a read tool cannot be pointed at another user",
  steered.json?.result?.structuredContent?.errorCode === "VALIDATION_ERROR"
);

// ---- Secret leakage --------------------------------------------------
console.log("\n## Secret leakage");

const everythingSeen = [
  adminList.text,
  adminDiag.text,
  whoami.text,
  pingCall.text,
  init.text,
].join("\n");
check("no response contains the service-role key", !everythingSeen.includes(serviceKey));
check("no response contains the anon key", !everythingSeen.includes(anonKey));
check(
  "no response contains an ANTHROPIC key",
  !process.env.ANTHROPIC_API_KEY || !everythingSeen.includes(process.env.ANTHROPIC_API_KEY)
);
check("no response leaks a Postgres error code", !/\b(42501|PGRST\d+|23505)\b/.test(everythingSeen));
check("no response leaks a stack trace", !everythingSeen.includes("at async") && !everythingSeen.includes(".ts:"));

// ---- Audit behaviour -------------------------------------------------
console.log("\n## Audit");

// Module 36 registers no write tools, so the assertion available here is
// the read half of the rule: reads must NOT write audit rows. The write
// half is exercised in Module 38, where the first mutating tool lands.
const { count: mcpAuditRows } = await admin
  .from("audit_logs")
  .select("id", { count: "exact", head: true })
  .like("action", "mcp.%");
check("read tools write no audit rows", (mcpAuditRows ?? 0) === 0);

// ---------------------------------------------------------------------
for (const id of createdUsers) await admin.auth.admin.deleteUser(id);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
