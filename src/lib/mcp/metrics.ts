import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

import type { McpActor } from "./context";
import { redactInput } from "./redact";
import type { ToolOutcome } from "./audit";
import type { AnyToolDefinition } from "./registry";

/**
 * MCP observability (Module 43; Master Build Plan 12B.7).
 *
 * WHAT THIS EXISTS TO FIX. Through Module 42 a tool call left exactly one
 * trace: a `logger.info` line on the process console. On this deployment
 * that is Vercel's log stream — not queryable from the application, and
 * gone by the time anyone asks why the assistant said it could not do
 * something. Worse, `recordToolCall()` returned early for every non-write
 * tool, so a FORBIDDEN on any of the nineteen read tools was persisted
 * NOWHERE. "Authorization failures are visible" was not true of the
 * product; it was true of whoever happened to be watching a console.
 *
 * TWO SHAPES, BECAUSE SUCCESSES AND REFUSALS ARE DIFFERENT DATA.
 * 12B.7's refusal to audit reads is kept intact for successes: they are
 * COUNTED, in an hourly bucket per tool, so a thousand calls are one row
 * and this can never grow with traffic. Refusals are KEPT, one row each
 * with the redacted arguments, because a refusal is not bulk data — it
 * is the single event an operator goes looking for.
 *
 * NEVER THROWS, and never delays the answer by more than the two writes
 * it makes. It inherits that contract from `logAudit()` for the same
 * reason: an observability failure must not turn a successful tool call
 * into a reported error. A metrics system that can break the thing it
 * measures is a liability, not an instrument.
 */

/** What the stats RPC is told about one completed call. */
function outcomeFlags(outcome: ToolOutcome) {
  return {
    failed: outcome.status === "FAILED",
    confirmation: outcome.status === "CONFIRMATION_REQUIRED",
  };
}

/**
 * Records one completed tool call: always a counter increment, plus a
 * failure row when it failed.
 *
 * The two writes go together rather than in sequence — a serverless
 * instance can be frozen the moment the response is returned, so both
 * are awaited, and awaiting them one after the other would double the
 * latency for no benefit.
 */
export async function recordToolMetrics(params: {
  tool: AnyToolDefinition;
  actor: McpActor;
  input: unknown;
  outcome: ToolOutcome;
  requestId: string;
  durationMs: number;
}): Promise<void> {
  const { tool, actor, outcome, requestId, durationMs } = params;
  const { failed, confirmation } = outcomeFlags(outcome);

  try {
    const admin = createAdminClient();

    // `PromiseLike`, not `Promise`: a PostgREST builder is thenable and
    // only executes when awaited, which is exactly the shape needed to
    // start both writes and wait once.
    const writes: PromiseLike<{ error: { message: string } | null }>[] = [
      admin.rpc("record_mcp_tool_call", {
        p_tool_name: tool.name,
        p_failed: failed,
        p_confirmation: confirmation,
        p_duration_ms: Math.round(durationMs),
      }),
    ];

    if (outcome.status === "FAILED") {
      writes.push(
        admin.from("mcp_tool_failures").insert({
          request_id: requestId,
          tool_name: tool.name,
          actor_id: actor.id,
          actor_role: actor.role,
          error_code: outcome.errorCode,
          // Redacted by the same function the audit row uses. A failure
          // row must not become the one place a secret got written down
          // because it was the one path nobody re-read.
          input: redactInput(params.input),
          duration_ms: Math.round(durationMs),
        })
      );
    }

    const results = await Promise.all(writes);
    for (const result of results) {
      if (result?.error) {
        logger.warn("mcp metrics write failed", { tool: tool.name, message: result.error.message });
      }
    }
  } catch (error) {
    logger.warn("mcp metrics write threw", {
      tool: tool.name,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Records a call the rate limiter refused.
 *
 * SEPARATE FROM `recordToolMetrics` because a throttled request never
 * reached the dispatcher: no tool ran, nothing was validated, and
 * counting it as a call would inflate the very metric an operator uses
 * to judge how busy the assistant is. It is a refusal and nothing else,
 * so it lands in the failures table alone.
 *
 * Before this, a 429 was invisible: the route returned it and no trace
 * survived the request. "The assistant kept saying it was busy" was
 * therefore unanswerable after the fact, which is the shape of complaint
 * this module exists to make answerable.
 */
export async function recordRateLimited(params: {
  /** The tool the caller was asking for, or the JSON-RPC method when it was not a tool call. */
  subject: string;
  actor: McpActor;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("mcp_tool_failures").insert({
      tool_name: params.subject,
      actor_id: params.actor.id,
      actor_role: params.actor.role,
      error_code: "RATE_LIMITED",
      // No arguments: the request was refused before anything parsed
      // them, and recording a shape nothing validated would be a guess.
      input: null,
    });
    if (error) {
      logger.warn("mcp rate limit event write failed", { message: error.message });
    }
  } catch (error) {
    logger.warn("mcp rate limit event write threw", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
