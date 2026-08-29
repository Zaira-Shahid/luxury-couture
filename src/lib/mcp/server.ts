import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { recordToolCall, type ToolOutcome } from "./audit";
import { assertToolAccess } from "./auth";
import {
  CONFIRMATION_TTL_SECONDS,
  createConfirmationToken,
  isConfirmationConfigured,
  verifyConfirmationToken,
} from "./confirm";
import type { McpActor, McpContext } from "./context";
import { McpError, toMcpError } from "./errors";
import { consumeConfirmation } from "./replay";
import {
  isNotification,
  JSON_RPC,
  jsonRpcFailure,
  jsonRpcSuccess,
  type JsonRpcRequest,
  type JsonRpcResponse,
  MCP_PROTOCOL_VERSION,
  SERVER_CAPABILITIES,
  SERVER_INFO,
  SUPPORTED_PROTOCOL_VERSIONS,
} from "./protocol";
import { describeTool, type AnyToolDefinition, type ToolRegistry } from "./registry";
import { confirmationResult, errorResult, successResult, type McpCallResult } from "./result";

/**
 * The MCP dispatcher (Master Build Plan section 12B.2).
 *
 * Transport-free on purpose: it takes a parsed JSON-RPC message and an
 * already-authenticated actor, and returns a response. The route handler
 * owns HTTP, cookies and rate limiting; this owns the protocol. That split
 * is what lets `scripts/test-mcp.mjs` drive real calls, and what would let
 * Module 43 add a second transport over the same registry without
 * touching any of the logic below.
 *
 * The pipeline for a tool call is fixed and its ORDER is the security
 * design (section 12B.8 of the instruction — natural language must never
 * become a database command):
 *
 *   registry lookup -> authorization -> schema validation ->
 *   confirmation gate -> handler -> application service -> audit
 *
 * Authorization precedes validation deliberately: a caller with no right
 * to a tool learns only that, never which arguments it would have wanted.
 */

/** The one argument the server owns rather than the tool's own schema. */
const CONFIRMATION_ARG = "confirmationToken";

export type McpServerDeps = {
  registry: ToolRegistry;
  actor: McpActor;
  supabase: SupabaseClient;
  /** Injectable for tests. */
  now?: () => Date;
};

export async function handleJsonRpc(
  request: JsonRpcRequest,
  deps: McpServerDeps
): Promise<JsonRpcResponse | null> {
  // A notification gets no response at all, per JSON-RPC 2.0. The only one
  // an MCP client sends us is `notifications/initialized`, and answering
  // it would be a protocol violation rather than a harmless extra.
  if (isNotification(request)) {
    return null;
  }
  const id = request.id ?? null;

  switch (request.method) {
    case "initialize":
      return jsonRpcSuccess(id, initialize(request.params));

    case "ping":
      // The spec's own liveness check: an empty result is the whole
      // contract. Distinct from the `system_ping` TOOL, which is what an
      // assistant can call to tell a human the link is healthy.
      return jsonRpcSuccess(id, {});

    case "tools/list":
      return jsonRpcSuccess(id, {
        tools: deps.registry.visibleTo(deps.actor.permissions).map(describeTool),
      });

    case "tools/call":
      return await callTool(id, request.params, deps);

    default:
      return jsonRpcFailure(id, JSON_RPC.METHOD_NOT_FOUND, `Unknown method: ${request.method}`);
  }
}

function initialize(params: Record<string, unknown> | undefined) {
  const requested = typeof params?.protocolVersion === "string" ? params.protocolVersion : null;
  return {
    // Echo a version we both know; otherwise state ours and let the client
    // decide whether it can proceed, which is what the spec requires.
    protocolVersion:
      requested && SUPPORTED_PROTOCOL_VERSIONS.includes(requested)
        ? requested
        : MCP_PROTOCOL_VERSION,
    capabilities: SERVER_CAPABILITIES,
    serverInfo: SERVER_INFO,
  };
}

async function callTool(
  id: string | number | null,
  params: Record<string, unknown> | undefined,
  deps: McpServerDeps
): Promise<JsonRpcResponse> {
  const name = params?.name;
  if (typeof name !== "string" || !name) {
    return jsonRpcFailure(id, JSON_RPC.INVALID_PARAMS, "A tool name is required.");
  }

  const tool = deps.registry.get(name);
  if (!tool) {
    // A protocol-level error, not a tool result: the tool genuinely does
    // not exist, so there is no tool to report a failure from. The message
    // never lists what DOES exist — that is `tools/list`, which is
    // permission-filtered.
    return jsonRpcFailure(id, JSON_RPC.INVALID_PARAMS, `Unknown tool: ${name}`);
  }

  const rawArgs =
    typeof params?.arguments === "object" && params.arguments !== null && !Array.isArray(params.arguments)
      ? (params.arguments as Record<string, unknown>)
      : {};

  const result = await executeTool(tool, rawArgs, deps);
  return jsonRpcSuccess(id, result);
}

/**
 * Runs one tool call and always returns a result envelope — including for
 * refusals, which are reported as tool errors rather than JSON-RPC errors
 * so the assistant sees them as something to explain to the user rather
 * than as a broken connection.
 */
async function executeTool(
  tool: AnyToolDefinition,
  rawArgs: Record<string, unknown>,
  deps: McpServerDeps
): Promise<McpCallResult> {
  const requestId = randomUUID();
  const startedAt = Date.now();
  const ctx: McpContext = {
    actor: deps.actor,
    supabase: deps.supabase,
    requestId,
    now: deps.now ? deps.now() : new Date(),
  };

  // The server owns this argument, so it is removed before the tool's own
  // schema runs. Tool schemas are `.strict()`, and leaving it in would
  // make every high-risk tool reject its own confirmation.
  const { [CONFIRMATION_ARG]: confirmationToken, ...toolArgs } = rawArgs;

  let outcome: ToolOutcome = { status: "FAILED", errorCode: "INTERNAL_ERROR" };
  let response: McpCallResult;

  try {
    // 1. AUTHORIZATION — before validation, so a refused caller learns
    //    nothing about the tool's shape.
    assertToolAccess(tool, deps.actor);

    // 2. VALIDATION — the AI's arguments are untrusted input. Nothing
    //    downstream sees a field this schema did not accept.
    const parsed = tool.inputSchema.safeParse(toolArgs);
    if (!parsed.success) {
      throw new McpError(
        "VALIDATION_ERROR",
        "Some of those details weren't valid.",
        // Paths, codes and key names come from our own schema, so they
        // are safe to return — and they are what lets an assistant
        // correct itself instead of retrying the identical bad call.
        //
        // `code` and `keys` are carried alongside the message rather than
        // relying on it: Zod's human-readable text is genericised to
        // "Invalid input" in the production bundle, so a caller told only
        // the message would not learn WHICH argument was wrong. The
        // structured fields survive bundling.
        //
        // Annotated structurally: `inputSchema` is the base `z.ZodType`
        // in the registry (it holds tools of many different input types),
        // so Zod cannot infer the issue type here.
        parsed.error.issues.map(
          (issue: { path: PropertyKey[]; message: string; code?: string; keys?: string[] }) => ({
            field: issue.path.join(".") || "(root)",
            code: issue.code ?? "invalid",
            message: issue.message,
            ...(issue.keys?.length ? { unexpectedFields: issue.keys } : {}),
          })
        )
      );
    }

    // 3. CONFIRMATION GATE — high-risk actions do not execute on the
    //    first call. Section 12B.6.
    if (tool.risk === "high") {
      // Fails closed: with no signing secret we cannot issue a token
      // anyone could verify, so the action is refused rather than run
      // unconfirmed.
      if (!isConfirmationConfigured()) {
        throw new McpError(
          "INTERNAL_ERROR",
          "This action can't be confirmed right now. No changes were made."
        );
      }
      const subject = { toolName: tool.name, args: parsed.data, actorId: deps.actor.id };
      const provided = typeof confirmationToken === "string" ? confirmationToken : null;
      const check = provided ? verifyConfirmationToken(provided, subject) : null;

      if (!check?.valid) {
        // describeImpact() must not mutate: it exists to state the blast
        // radius. The registry refuses to register a high-risk tool
        // without one.
        const impact = await tool.describeImpact!(parsed.data, ctx);
        outcome = { status: "CONFIRMATION_REQUIRED", affectedRecords: impact.affectedRecords };
        response = confirmationResult({
          action: tool.title,
          summary:
            check?.reason === "expired"
              ? `${impact.summary} (the previous confirmation expired, so nothing was done)`
              : impact.summary,
          affectedRecords: impact.affectedRecords,
          confirmationToken: createConfirmationToken(subject),
          expiresInSeconds: CONFIRMATION_TTL_SECONDS,
        });
        return response;
      }

      // The token is valid. SPEND IT BEFORE ACTING (Module 38, 0063).
      //
      // The signature check alone proves "an admin confirmed this exact
      // action", not "this action has not already run" — the token is
      // stateless and stays verifiable for its whole five-minute life.
      // Consuming first is what makes the second call lose: the ledger's
      // unique constraint decides the race, not the order two concurrent
      // requests happen to reach the handler.
      const spent = await consumeConfirmation({
        token: provided!,
        actorId: deps.actor.id,
        toolName: tool.name,
      });
      if (spent === "already-used") {
        throw new McpError(
          "CONFLICT",
          "That confirmation has already been used. Nothing was done a second time."
        );
      }
      if (spent === "unavailable") {
        // Fails closed. "We could not check whether this already ran" is
        // not the same claim as "this is the first time", and a
        // destructive action must not run on the weaker one.
        throw new McpError(
          "INTERNAL_ERROR",
          "This action could not be confirmed safely. No changes were made."
        );
      }
    }

    // 4. THE APPLICATION SERVICE. Handlers call the same readers and the
    //    same Server Actions the admin UI calls, under the caller's own
    //    Supabase client, so RLS applies (section 12B.11).
    const handled = await tool.handler(parsed.data, ctx);
    outcome = { status: "SUCCESS", action: handled.action, target: handled.target };
    response = successResult(handled);
    return response;
  } catch (error) {
    const mcpError = toMcpError(error, `tool:${tool.name}`);
    outcome = { status: "FAILED", errorCode: mcpError.code };
    response = errorResult(mcpError, tool.title);
    return response;
  } finally {
    // 5. AUDIT — in `finally`, so a call that failed is recorded just as a
    //    call that succeeded is. A log holding only successes cannot answer
    //    "what did it try to do", which is the question asked afterwards.
    //    Awaited rather than fire-and-forget: a serverless instance can be
    //    frozen the moment the response is returned.
    await recordToolCall({
      tool,
      actor: deps.actor,
      input: toolArgs,
      outcome,
      requestId,
      durationMs: Date.now() - startedAt,
    });
  }
}
