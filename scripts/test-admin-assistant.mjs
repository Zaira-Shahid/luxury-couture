// Module 42 — the admin AI chat interface.
//
// Three parts, in the order they can be trusted:
//
//  1. THE LOOP, driven by a scripted model. Run as a child process
//     because it needs Node's type-stripping hook to import the `.ts`
//     modules; scripts/lib/assistant-loop-checks.mjs holds it and says
//     what is real in there and what is not. This is where the module's
//     security claims are actually tested — the confirmation stop, the
//     token that never reaches the model, the bounded loop.
//
//  2. THE ROUTE, over HTTP, with real accounts. Authentication,
//     authorization and input limits, all of which happen before a model
//     is ever reached and so cost nothing to test.
//
//  3. THE SOURCE, for the invariants that are structural rather than
//     behavioural — that the chat goes through the dispatcher rather than
//     around it, that the page is not gated on a single permission, that
//     no transcript is persisted.
//
// NOT TESTED HERE: a real model. Every check uses either a scripted
// client or a request that fails before the API is called, so this suite
// spends nothing and needs no ANTHROPIC_API_KEY.
//
//   node --env-file=.env.local scripts/test-admin-assistant.mjs
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
console.log("# Part A — the loop, driven by a scripted model");
// =====================================================================

const child = spawnSync(
  process.execPath,
  ["--import", "./scripts/lib/ts-node-hook.mjs", "scripts/lib/assistant-loop-checks.mjs"],
  { encoding: "utf8" }
);

const childOutput = `${child.stdout ?? ""}${child.stderr ?? ""}`;
for (const line of childOutput.split("\n")) {
  // The child prints in this suite's own format; pass its results
  // through so run-suite.mjs counts them with everything else. Its log
  // lines and the type-stripping warning are dropped.
  if (line.startsWith("PASS — ")) {
    passed += 1;
    console.log(line);
  } else if (line.startsWith("FAIL — ")) {
    failed += 1;
    console.log(line);
  } else if (line.startsWith("#")) {
    console.log(line.replace(/^#+/, "##"));
  }
}

check(
  "the loop checks ran to completion",
  child.status === 0 && childOutput.includes("passed, 0 failed")
);
if (child.status !== 0 && !childOutput.includes("passed,")) {
  console.log(childOutput.split("\n").slice(-15).join("\n"));
}

// =====================================================================
console.log("\n# Part B — the route, with real accounts");
// =====================================================================

const suffix = Date.now();
const createdUsers = [];
await purgeDevtestData(admin);

async function actor(role) {
  const email = `m42-${role}-${suffix}@luxury-couture-devtest.local`;
  const password = `m42-test-${role}-${suffix}`;
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
  const { data: session, error: signInErr } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (signInErr) throw new Error(`signIn(${role}) failed: ${signInErr.message}`);

  createdUsers.push(user.user.id);
  return { id: user.user.id, email, role, session: session.session };
}

const actors = {
  super_admin: await actor("super_admin"),
  // Holds a handful of permissions and none of the catalogue ones — the
  // account that proves the screen is open to staff whose tools differ.
  production: await actor("production"),
  customer: await actor("customer"),
};

async function ask(who, body) {
  const headers = { "content-type": "application/json" };
  if (who) headers.authorization = `Bearer ${who.session.access_token}`;
  const res = await fetch(`${APP_URL}/api/admin/assistant`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* left null — whichever check cares will fail on it */
  }
  return { status: res.status, json };
}

console.log("\n## Who may talk to it");

check(
  "an anonymous request is refused",
  (await ask(null, { message: "how many orders?" })).status === 401
);
check(
  "a signed-in CUSTOMER is refused — this is a staff tool",
  (await ask(actors.customer, { message: "how many orders?" })).status === 403
);
check(
  "the refusal does not tell a customer which permission they lack",
  !JSON.stringify((await ask(actors.customer, { message: "hi" })).json ?? {}).includes(".read")
);

const staffTurn = await ask(actors.production, { message: "how many orders are unpaid?" });
check(
  "a staff account gets past authorization",
  staffTurn.status !== 401 && staffTurn.status !== 403
);
// Without a key the route says so plainly rather than 500ing out of the
// SDK. With one, this deployment would spend money on a real turn, so
// the check adapts rather than being skipped silently.
check(
  process.env.ANTHROPIC_API_KEY
    ? "with an API key configured, a staff turn is attempted"
    : "with no API key, the route says the assistant is not configured",
  process.env.ANTHROPIC_API_KEY
    ? staffTurn.status !== 503
    : staffTurn.status === 503 && staffTurn.json?.error?.includes("ANTHROPIC_API_KEY")
);

console.log("\n## What it accepts");

check("an empty message is refused", (await ask(actors.super_admin, { message: "  " })).status === 400);
check(
  "a message that is not a string is refused",
  (await ask(actors.super_admin, { message: { toString: 1 } })).status === 400
);
check(
  "an over-long message is refused rather than sent to the model",
  (await ask(actors.super_admin, { message: "x".repeat(2001) })).status === 413
);
check(
  "an over-long conversation is refused",
  (
    await ask(actors.super_admin, {
      message: "hi",
      messages: Array.from({ length: 61 }, () => ({ role: "user", content: "hi" })),
    })
  ).status === 413
);
check(
  "a malformed approval is not treated as an approval",
  (await ask(actors.super_admin, { approve: { tool: 42 } })).status === 400
);
check(
  "an approval missing its input is refused",
  (await ask(actors.super_admin, { approve: { tool: "products_archive", toolUseId: "t1", summary: "x" } }))
    .status === 400
);

const badJson = await fetch(`${APP_URL}/api/admin/assistant`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: "{not json",
});
check("malformed JSON is refused", badJson.status === 400);

const get = await fetch(`${APP_URL}/api/admin/assistant`);
check("GET is answered with 405 and an allow header", get.status === 405 && get.headers.get("allow") === "POST");

console.log("\n## The screen");

const anonPage = await fetch(`${APP_URL}/admin/assistant`, { redirect: "manual" });
check(
  "the page itself is behind the admin gate",
  anonPage.status === 307 || anonPage.status === 302 || anonPage.status === 401
);

// =====================================================================
console.log("\n# Part C — the invariants, asserted at the source");
// =====================================================================

const chat = readFileSync("src/lib/mcp/chat.ts", "utf8");
const route = readFileSync("src/app/api/admin/assistant/route.ts", "utf8");
const page = readFileSync("src/app/(admin)/admin/assistant/page.tsx", "utf8");
const ui = readFileSync("src/components/admin/assistant-chat.tsx", "utf8");
const nav = readFileSync("src/components/admin/admin-nav-items.ts", "utf8");

check(
  "every tool call goes through the MCP dispatcher, not around it",
  chat.includes("handleJsonRpc(") && !/registry\.get\([^)]*\)[.\s]*\.?handler\(/.test(chat)
);
check(
  "the loop never sends a confirmation token to the model",
  !/messages\.create[\s\S]{0,400}confirmationToken/.test(chat)
);
check(
  "only the approval path ever attaches one",
  (chat.match(/confirmationToken: proposal\.confirmationToken/g) ?? []).length === 1
);
check(
  "the approval path is a separate export the model cannot call",
  chat.includes("export async function resumeWithApproval")
);
check(
  "an approval is refused unless the registry calls the tool high risk",
  /definition\.risk !== "high"/.test(chat)
);
check(
  "the model is shown only the tools the actor may use",
  chat.includes("registry.visibleTo(actor.permissions)")
);
check(
  "the tool schemas come from the registry rather than a second copy",
  chat.includes("describeTool(tool)") && !chat.includes("input_schema: {")
);
check("the loop is bounded", /MAX_ITERATIONS = \d+/.test(chat));
check(
  "running out of iterations is reported as a failure, not an answer",
  /status: "failed"[\s\S]{0,300}too many steps/.test(chat)
);

check(
  "the route authenticates through the same resolver the MCP endpoint uses",
  route.includes("resolveCaller(request.headers)")
);
check("the route rate limits per actor", route.includes("caller.actor.id"));
check("the route runs on Node, not the Edge", route.includes('runtime = "nodejs"'));
check("and is never cached", route.includes('dynamic = "force-dynamic"'));
check(
  "no transcript is written to the database",
  !/from\("(assistant|chat)_/.test(route) && !/from\("(assistant|chat)_/.test(chat)
);
check(
  "the approval echoed back from the browser is shape-checked",
  route.includes("isPendingConfirmation")
);

check(
  "the page is not gated on a single permission — each tool carries its own",
  !page.includes("redirect(") && !page.includes("permissionForAdminPath")
);
check(
  "the page tells the person how much of the toolset their account reaches",
  page.includes("visibleTo(permissions)")
);
check(
  "the assistant appears in the admin nav",
  nav.includes('href: "/admin/assistant"')
);
check(
  "the nav entry needs no permission of its own",
  !/\/admin\/assistant[\s\S]{0,200}permission:/.test(nav)
);

check(
  "the browser holds the conversation — nothing is stored server-side",
  ui.includes("useState<AssistantMessage[]>([])")
);
check(
  "the assistant module reaches the client as types only",
  /import type \{[^}]*\} from "@\/lib\/mcp\/chat"/.test(ui)
);
check("the transcript shows which tools were called", ui.includes("Used {readableToolName"));
check(
  "the confirmation card states that nothing has happened yet",
  ui.includes("Nothing has happened yet")
);
check("and offers a way to decline", ui.includes("Cancel"));
check(
  "declining does not silently drop the request — the model is told",
  ui.includes("I did not approve that")
);

// ---- Cleanup ---------------------------------------------------------
await purgeDevtestData(admin);
for (const id of createdUsers) {
  await admin.auth.admin.deleteUser(id).catch(() => {});
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
