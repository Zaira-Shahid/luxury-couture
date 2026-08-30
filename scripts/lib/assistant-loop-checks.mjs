// The assistant loop, driven by a scripted model — Module 42.
//
// Run through scripts/test-admin-assistant.mjs, which supplies the
// `--import` hook that lets Node load the `.ts` modules. Everything below
// the loop is the real thing: the real registry, the real JSON-RPC
// dispatcher, the real permission check, the real HMAC confirmation
// tokens, the real replay ledger and the real audit write. Only two
// things are substituted, and both are substituted BECAUSE they are what
// the test is about:
//
//   - the model, which is a script of canned responses. The point of
//     these checks is what the loop does with a given model output, and
//     a live model would make that non-deterministic and expensive.
//   - the tools, which are four synthetic definitions rather than the
//     fifty real ones. A test that archived real products to prove the
//     confirmation gate works would be proving it the expensive way.
//
// The actor is a REAL staff account, because the audit write has a
// foreign key to it and a fake id would make the audit assertions vacuous.
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { runAssistantTurn, resumeWithApproval } from "../../src/lib/mcp/chat.ts";
import { buildRegistry } from "../../src/lib/mcp/registry.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

// ---- The account -----------------------------------------------------
const suffix = Date.now();
const email = `m42-loop-${suffix}@luxury-couture-devtest.local`;
const { data: created, error: createErr } = await admin.auth.admin.createUser({
  email,
  password: `m42-loop-${suffix}`,
  email_confirm: true,
});
if (createErr) throw new Error(`createUser failed: ${createErr.message}`);
const actorId = created.user.id;
await admin.from("profiles").update({ role: "super_admin" }).eq("id", actorId);

// The permission set is deliberately PARTIAL: it holds two of the three
// keys the synthetic tools declare, so "the model is shown only what this
// account may use" has something to exclude.
const actor = {
  id: actorId,
  email,
  role: "super_admin",
  permissions: new Set(["orders.read", "products.write"]),
};

// ---- The tools -------------------------------------------------------
let lookups = 0;
let archived = 0;
let forbiddenReached = 0;

const registry = buildRegistry([
  {
    name: "demo_lookup",
    title: "Demo lookup",
    description: "Counts demo records. Reads nothing real.",
    kind: "read",
    risk: "low",
    permission: "orders.read",
    inputSchema: z.object({ needle: z.string() }).strict(),
    handler: async (input) => {
      lookups += 1;
      return { action: "Looked up", data: { count: 3, needle: input.needle } };
    },
  },
  {
    name: "demo_open",
    title: "Demo open",
    description: "Needs no permission at all.",
    kind: "read",
    risk: "low",
    permission: null,
    inputSchema: z.object({}).strict(),
    handler: async () => {
      throw new Error("demo_open always fails, on purpose");
    },
  },
  {
    name: "demo_forbidden",
    title: "Demo forbidden",
    description: "Requires a permission this actor does not hold.",
    kind: "read",
    risk: "low",
    permission: "settings.manage",
    inputSchema: z.object({}).strict(),
    handler: async () => {
      forbiddenReached += 1;
      return { action: "Should never happen", data: {} };
    },
  },
  {
    name: "demo_archive",
    title: "Demo archive",
    description: "A high-risk write, so it must be confirmed by a person.",
    kind: "write",
    risk: "high",
    permission: "products.write",
    inputSchema: z.object({ scope: z.string() }).strict(),
    describeImpact: async (input) => ({
      summary: `This would archive 24 ${input.scope} records.`,
      affectedRecords: 24,
    }),
    handler: async (input) => {
      archived += 1;
      return {
        action: "Demo records archived",
        data: { archived: 24, scope: input.scope },
        target: { type: "demo", id: null },
      };
    },
  },
]);

const deps = () => ({ registry, actor, supabase: admin });

/** A model that answers with a fixed script, and remembers what it was asked. */
function scriptedClient(script) {
  const calls = [];
  let turn = 0;
  return {
    calls,
    messages: {
      create: async (params) => {
        calls.push(params);
        const next = script[Math.min(turn, script.length - 1)];
        turn += 1;
        return typeof next === "function" ? next() : next;
      },
    },
  };
}

const text = (value) => ({ type: "text", text: value });
const toolUse = (id, name, input) => ({ type: "tool_use", id, name, input });
const wantsTool = (...blocks) => ({ content: blocks, stop_reason: "tool_use" });
const answers = (value) => ({ content: [text(value)], stop_reason: "end_turn" });

/**
 * Every tool_result in a finished turn.
 *
 * Read off the RETURNED conversation rather than off what the scripted
 * client was called with: the loop passes the same array by reference on
 * every iteration, so the captured params keep changing under you.
 */
const resultsIn = (turnResult) =>
  turnResult.messages
    .flatMap((message) => (Array.isArray(message.content) ? message.content : []))
    .filter((block) => block.type === "tool_result");

// =====================================================================
console.log("# The registry, as the model is shown it");
// =====================================================================
{
  const client = scriptedClient([answers("Nothing to do.")]);
  await runAssistantTurn([], "hello", { ...deps(), client });
  const advertised = client.calls[0].tools.map((tool) => tool.name);

  check(
    "the model is shown the tools this account may use",
    advertised.includes("demo_lookup") && advertised.includes("demo_archive")
  );
  check("a tool with no permission at all is shown", advertised.includes("demo_open"));
  check(
    "a tool the account lacks the permission for is not shown",
    !advertised.includes("demo_forbidden")
  );
  check(
    "the advertised schema is the tool's own, not a second description",
    client.calls[0].tools.find((t) => t.name === "demo_lookup")?.input_schema?.properties?.needle
      ?.type === "string"
  );
  check(
    "the request asks for the current model with adaptive thinking",
    client.calls[0].model === "claude-opus-5" && client.calls[0].thinking?.type === "adaptive"
  );
}

// =====================================================================
console.log("\n# A read, answered");
// =====================================================================
{
  const client = scriptedClient([
    wantsTool(toolUse("t1", "demo_lookup", { needle: "lehenga" })),
    answers("There are three."),
  ]);
  const before = lookups;
  const turn = await runAssistantTurn([], "how many?", { ...deps(), client });

  check("a read tool call runs and the turn is answered", turn.status === "answered");
  check("the handler ran exactly once", lookups === before + 1);
  check("the reply is the model's own words", turn.reply === "There are three.");
  check(
    "the tool result carries the structured payload back to the model",
    resultsIn(turn)[0]?.content?.includes('"count":3')
  );
  check(
    "the conversation is returned for the browser to keep",
    turn.messages.length === 4 && turn.messages[0].content === "how many?"
  );
}

// =====================================================================
console.log("\n# A refusal is reported as a refusal");
// =====================================================================
{
  const client = scriptedClient([
    wantsTool(toolUse("t1", "demo_forbidden", {})),
    answers("You do not have permission for that."),
  ]);
  const turn = await runAssistantTurn([], "open the settings", { ...deps(), client });
  const result = resultsIn(turn)[0];

  check("a tool the account may not use never reaches its handler", forbiddenReached === 0);
  check("the refusal is marked as an error, not returned as data", result?.is_error === true);
  check("the refusal names the permission model, not the arguments", result?.content?.includes("FORBIDDEN"));
  check("the turn still completes rather than throwing", turn.status === "answered");
}

// =====================================================================
console.log("\n# A failing tool");
// =====================================================================
{
  const client = scriptedClient([wantsTool(toolUse("t1", "demo_open", {})), answers("That failed.")]);
  const turn = await runAssistantTurn([], "try it", { ...deps(), client });
  const result = resultsIn(turn)[0];

  check("a handler that throws comes back as FAILED", result?.content?.includes('"FAILED"'));
  check("and is marked is_error so the model cannot read it as data", result?.is_error === true);
}

// =====================================================================
console.log("\n# The confirmation stop — the whole point of the module");
// =====================================================================
{
  const client = scriptedClient([
    wantsTool(toolUse("t1", "demo_archive", { scope: "bridal" })),
    answers("SHOULD NOT BE REACHED"),
  ]);
  const before = archived;
  const turn = await runAssistantTurn([], "archive the bridal records", { ...deps(), client });

  check("the loop stops and asks a person", turn.status === "needs_confirmation");
  check("nothing was archived", archived === before);
  check(
    "the person is shown the dispatcher's own description of the change",
    turn.pending?.summary === "This would archive 24 bridal records."
  );
  check("and its blast radius", turn.pending?.affectedRecords === 24);
  check("the input shown is the input that was proposed", turn.pending?.input?.scope === "bridal");
  check(
    "THE MODEL IS NEVER HANDED A TOKEN",
    !JSON.stringify(turn.messages).includes("confirmationToken")
  );
  check(
    "and no token reaches the browser either",
    !JSON.stringify(turn.pending).includes("confirmationToken")
  );
  check("the model was not asked to continue after the stop", client.calls.length === 1);
  check(
    "the model is told plainly that it has NOT been done",
    resultsIn(turn)[0]?.content?.includes("NOT been done")
  );
}

// =====================================================================
console.log("\n# Parallel calls stay well-formed");
// =====================================================================
{
  const client = scriptedClient([
    wantsTool(
      toolUse("t1", "demo_lookup", { needle: "one" }),
      toolUse("t2", "demo_archive", { scope: "all" }),
      toolUse("t3", "demo_lookup", { needle: "two" })
    ),
    answers("unused"),
  ]);
  const turn = await runAssistantTurn([], "do several things", { ...deps(), client });
  const ids = resultsIn(turn).map((block) => block.tool_use_id).sort();

  check("the confirmation still stops the turn", turn.status === "needs_confirmation");
  check("every tool_use has a tool_result — the conversation stays resumable", ids.join(",") === "t1,t2,t3");
  check(
    "the calls that were not run say so",
    resultsIn(turn).some((block) => block.content?.includes("Not run"))
  );
}

// =====================================================================
console.log("\n# Approval — the separate entry point");
// =====================================================================
{
  const pending = {
    toolUseId: "t1",
    tool: "demo_archive",
    summary: "This would archive 24 bridal records.",
    affectedRecords: 24,
    input: { scope: "bridal" },
  };

  const before = archived;
  const client = scriptedClient([answers("Archived 24 records.")]);
  const turn = await resumeWithApproval(
    [{ role: "user", content: "archive the bridal records" }],
    pending,
    { ...deps(), client }
  );

  check("the approved action runs", archived === before + 1);
  check("exactly once", archived === before + 1);
  check("and the assistant reports it", turn.status === "answered" && turn.reply.includes("24"));
  check(
    "the token stays server-side — it is in neither the reply nor the conversation",
    !JSON.stringify(turn.messages).includes("confirmationToken")
  );

  const { data: spent } = await admin
    .from("mcp_confirmations")
    .select("signature, tool_name")
    .eq("actor_id", actorId);
  check("the confirmation was spent against the replay ledger", (spent?.length ?? 0) === 1);
  check("under the tool that was approved", spent?.[0]?.tool_name === "demo_archive");

  const { data: audited } = await admin
    .from("audit_logs")
    .select("action, actor_id")
    .eq("actor_id", actorId);
  check("and the write is in the audit trail", (audited?.length ?? 0) >= 1);
}

// =====================================================================
console.log("\n# Approval cannot be pointed at anything else");
// =====================================================================
{
  const lookupsBefore = lookups;
  const client = scriptedClient([answers("unused")]);

  const notHighRisk = await resumeWithApproval(
    [],
    { toolUseId: "t1", tool: "demo_lookup", summary: "…", affectedRecords: 1, input: { needle: "x" } },
    { ...deps(), client }
  );
  check(
    "approving a tool that never needed approval is refused",
    notHighRisk.status === "failed"
  );
  check(
    "and it is refused BEFORE it runs — no action taken on the way to finding out",
    lookups === lookupsBefore
  );

  const unknown = await resumeWithApproval(
    [],
    { toolUseId: "t1", tool: "demo_nonexistent", summary: "…", affectedRecords: 1, input: {} },
    { ...deps(), client }
  );
  check("approving a tool that does not exist is refused", unknown.status === "failed");
  check("neither refusal spends a model call", client.calls.length === 0);
}

// =====================================================================
console.log("\n# The loop is bounded, and failures are honest");
// =====================================================================
{
  const client = scriptedClient([
    () => wantsTool(toolUse(`t${Math.random()}`, "demo_lookup", { needle: "again" })),
  ]);
  const turn = await runAssistantTurn([], "loop forever", { ...deps(), client });

  check("a model that never finishes ends the turn as a failure", turn.status === "failed");
  check("not as an answer", turn.reply === "");
  check("the loop stops at its iteration cap", client.calls.length === 12);
}

{
  const client = {
    calls: [],
    messages: {
      create: async () => {
        throw new Error("network down");
      },
    },
  };
  const turn = await runAssistantTurn([], "anything", { ...deps(), client });

  check("an unreachable model is a failed turn", turn.status === "failed");
  check(
    "described in words a person can act on, and never as success",
    turn.error === "Something went wrong. Nothing was changed."
  );
}

// ---- Cleanup ---------------------------------------------------------
await admin.from("mcp_confirmations").delete().eq("actor_id", actorId);
await admin.from("audit_logs").delete().eq("actor_id", actorId);
await admin.auth.admin.deleteUser(actorId).catch(() => {});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
