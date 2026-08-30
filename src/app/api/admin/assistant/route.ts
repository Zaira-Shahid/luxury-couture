import { type NextRequest, NextResponse } from "next/server";

import { isAiConfigured } from "@/lib/ai";
import { resolveCaller } from "@/lib/mcp/auth";
import {
  resumeWithApproval,
  runAssistantTurn,
  type AssistantMessage,
  type PendingConfirmation,
} from "@/lib/mcp/chat";
import { McpError } from "@/lib/mcp/errors";
import { toolRegistry } from "@/lib/mcp/tools";
import { checkRateLimit } from "@/lib/security/rate-limit";

/**
 * The admin assistant endpoint (Module 42).
 *
 * Like /api/mcp, this route owns HTTP and nothing else. The loop lives in
 * lib/mcp/chat.ts and every tool call inside it goes through the same
 * dispatcher this application's MCP endpoint uses, so authorization, the
 * confirmation gate, the replay ledger and the audit trail are not
 * re-implemented here and cannot drift from it.
 *
 * THE CONVERSATION LIVES IN THE BROWSER. It is posted up and handed back
 * on every turn, and nothing is written to the database — an admin chat
 * quoting order values and customer names is a second copy of data that
 * already has a home, and a transcript table would be one more thing to
 * gate, retain and eventually leak.
 *
 * That the client can therefore EDIT the history is not a privilege
 * escalation: `resolveCaller` re-reads the actor's role and permissions
 * from the database on every request, and the dispatcher re-checks each
 * tool against them. A forged history can make the model believe
 * something untrue; it cannot make a tool run that this same signed-in
 * person could not have run by calling /api/mcp directly.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A turn can cost several model calls, so this is lower than the MCP tool limit. */
const RATE_LIMIT = 20;

/** Long enough for a real request, short enough that no one pastes a document in. */
const MAX_MESSAGE_LENGTH = 2000;

/** A conversation, not an archive. Past this the context cost stops being worth it. */
const MAX_HISTORY_MESSAGES = 60;

function badRequest(error: string, status = 400) {
  return NextResponse.json({ status: "failed", error }, { status });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON.");
  }

  const { message, messages, approve } = (body ?? {}) as {
    message?: unknown;
    messages?: unknown;
    approve?: unknown;
  };

  const history = Array.isArray(messages) ? (messages as AssistantMessage[]) : [];
  if (history.length > MAX_HISTORY_MESSAGES) {
    return badRequest("This conversation is too long. Start a new one.", 413);
  }

  const approval = isPendingConfirmation(approve) ? approve : null;

  if (!approval) {
    if (typeof message !== "string" || !message.trim()) {
      return badRequest("A message is required.");
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return badRequest("That message is too long.", 413);
    }
  }

  // Authenticate BEFORE anything reads the database or costs money. Staff
  // only, and the role comes from `profiles`, never from the request.
  let caller;
  try {
    caller = await resolveCaller(request.headers);
  } catch (error) {
    const mcpError =
      error instanceof McpError
        ? error
        : new McpError("UNAUTHORIZED", "Sign in to use the assistant.");
    return NextResponse.json(
      { status: "failed", error: mcpError.message },
      { status: mcpError.code === "FORBIDDEN" ? 403 : 401 }
    );
  }

  // Said plainly rather than as a 500 from the SDK. Without a key this is
  // a screen that cannot work, and the person deserves to know which.
  if (!isAiConfigured()) {
    return NextResponse.json(
      {
        status: "failed",
        error: "The assistant is not configured on this deployment. Set ANTHROPIC_API_KEY.",
      },
      { status: 503 }
    );
  }

  const limit = await checkRateLimit(
    "admin-assistant",
    RATE_LIMIT,
    "Too many assistant requests. Please wait a moment and try again.",
    caller.actor.id
  );
  if (!limit.allowed) {
    return NextResponse.json({ status: "failed", error: limit.message }, { status: 429 });
  }

  const deps = {
    registry: toolRegistry,
    actor: caller.actor,
    supabase: caller.supabase,
  };

  // The two entry points are separate on purpose (see lib/mcp/chat.ts):
  // only a person's click reaches the one that spends a confirmation
  // token, and the token itself never leaves the server.
  const turn = approval
    ? await resumeWithApproval(history, approval, deps)
    : await runAssistantTurn(history, (message as string).trim(), deps);

  return NextResponse.json(turn);
}

/**
 * The approval echoed back from the browser.
 *
 * Shape-checked rather than trusted: a malformed `pending` would reach
 * the dispatcher as a tool name and arguments, and while the dispatcher
 * would refuse anything this actor may not do, "refused for the right
 * reason" is not a substitute for "never asked".
 */
function isPendingConfirmation(value: unknown): value is PendingConfirmation {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.tool === "string" &&
    !!candidate.tool &&
    typeof candidate.toolUseId === "string" &&
    typeof candidate.summary === "string" &&
    typeof candidate.input === "object" &&
    candidate.input !== null
  );
}

export function GET() {
  return NextResponse.json(
    { error: "This endpoint accepts POST." },
    { status: 405, headers: { allow: "POST" } }
  );
}
