import { type NextRequest, NextResponse } from "next/server";

import { resolveCaller } from "@/lib/mcp/auth";
import { McpError } from "@/lib/mcp/errors";
import {
  JSON_RPC,
  jsonRpcFailure,
  parseJsonRpcRequest,
  type JsonRpcResponse,
} from "@/lib/mcp/protocol";
import { handleJsonRpc } from "@/lib/mcp/server";
import { toolRegistry } from "@/lib/mcp/tools";
import { checkRateLimit } from "@/lib/security/rate-limit";

/**
 * The MCP endpoint (Module 36; Master Build Plan section 12B).
 *
 * This route owns HTTP and nothing else — parsing, authentication, rate
 * limiting, status codes. The protocol lives in lib/mcp/server.ts and the
 * capabilities live in the registry, so a second transport (Module 43)
 * would reimplement only this file.
 *
 * ORDER OF OPERATIONS, following the precedent set by /api/chat:
 *   1. parse
 *   2. AUTHENTICATE — before anything reads the database
 *   3. RATE LIMIT — per actor, before dispatch
 *   4. dispatch
 *
 * Node runtime, not Edge: the confirmation tokens use node:crypto and the
 * audit path uses the service-role client, neither of which belongs on the
 * Edge. Force-dynamic because every response depends on who is calling —
 * a cached MCP response would be one admin's data served to another.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One assistant conversation is a handful of calls; 60 per 10 minutes is generous for a human and cheap to exceed for a loop. */
const RATE_LIMIT = 60;

function jsonResponse(body: JsonRpcResponse | null, status = 200) {
  // A JSON-RPC notification produces no body at all. 202 is the correct
  // answer over HTTP: accepted, nothing to say.
  if (body === null) return new NextResponse(null, { status: 202 });
  return NextResponse.json(body, { status });
}

export async function POST(request: NextRequest) {
  // 1. Parse.
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse(jsonRpcFailure(null, JSON_RPC.PARSE_ERROR, "Invalid JSON."), 400);
  }

  // Batches are not supported. Saying so plainly beats processing the
  // first element and silently dropping the rest.
  if (Array.isArray(payload)) {
    return jsonResponse(
      jsonRpcFailure(null, JSON_RPC.INVALID_REQUEST, "Batch requests are not supported."),
      400
    );
  }

  const rpcRequest = parseJsonRpcRequest(payload);
  if (!rpcRequest) {
    return jsonResponse(
      jsonRpcFailure(null, JSON_RPC.INVALID_REQUEST, "Not a valid JSON-RPC 2.0 request."),
      400
    );
  }

  const id = rpcRequest.id ?? null;

  // 2. Authenticate. Every method requires it, `initialize` included:
  //    there is nothing here for an anonymous caller to discover, not even
  //    the server's capabilities.
  let caller;
  try {
    caller = await resolveCaller(request.headers);
  } catch (error) {
    const mcpError =
      error instanceof McpError ? error : new McpError("UNAUTHORIZED", "Sign in to use the assistant.");
    // Real HTTP status codes, so a client that inspects the transport
    // (and a browser devtools panel) sees the refusal for what it is.
    const status = mcpError.code === "FORBIDDEN" ? 403 : 401;
    return jsonResponse(
      jsonRpcFailure(id, JSON_RPC.INVALID_REQUEST, mcpError.message, { code: mcpError.code }),
      status
    );
  }

  // 3. Rate limit, keyed on the ACTOR rather than the address — the
  //    caller is authenticated by this point, and an assistant stuck in a
  //    loop is the realistic failure mode here, not an anonymous flood.
  const limit = await checkRateLimit(
    "mcp",
    RATE_LIMIT,
    "Too many assistant requests. Please wait a moment and try again.",
    caller.actor.id
  );
  if (!limit.allowed) {
    return jsonResponse(jsonRpcFailure(id, JSON_RPC.INTERNAL_ERROR, limit.message, { code: "RATE_LIMITED" }), 429);
  }

  // 4. Dispatch.
  const response = await handleJsonRpc(rpcRequest, {
    registry: toolRegistry,
    actor: caller.actor,
    supabase: caller.supabase,
  });

  return jsonResponse(response);
}

/**
 * No SSE stream and no server-initiated messages: this server never calls
 * back into a model, so there is nothing for a client to listen to. Saying
 * 405 is honest; leaving GET undefined would 404 and read as "wrong URL".
 */
export function GET() {
  return NextResponse.json(
    { error: "This MCP endpoint accepts POST with a JSON-RPC 2.0 request." },
    { status: 405, headers: { allow: "POST" } }
  );
}
