import { logger } from "@/lib/logger";
import { logAudit } from "@/lib/security/audit";

import type { McpActor } from "./context";
import { recordToolMetrics } from "./metrics";
import { redactInput } from "./redact";
import type { AnyToolDefinition, ToolTarget } from "./registry";


/**
 * Audit and observability for MCP tool calls (Master Build Plan 12B.7).
 *
 * WRITES GO TO THE EXISTING `audit_logs` TABLE through the existing
 * `logAudit()` helper — not to an MCP-specific table. That is the point:
 * "who changed this product" must have one answer regardless of whether
 * the change came through the admin UI or through an AI instruction, and
 * two tables would mean two half-answers and a join nobody remembers to
 * write.
 *
 * READS ARE NOT AUDITED to the database, and that is unchanged: no
 * `audit_logs` row is written for a read, because a row per successful
 * read would be a second copy of the catalogue that nobody would query.
 *
 * WHAT MODULE 43 ADDED ALONGSIDE IT. Reads are now COUNTED (an hourly
 * bucket per tool) and every FAILURE — read or write — is persisted with
 * its redacted arguments. See metrics.ts: the 12B.7 argument holds for
 * successes and collapses for refusals, which are the one event an
 * operator actually goes looking for and which this file used to drop on
 * the floor for every non-write tool.
 *
 * FAILURES ARE AUDITED TOO. A log containing only successes cannot answer
 * "what did it try to do", which is the question asked after an incident.
 */

export type ToolOutcome =
  | { status: "SUCCESS"; action: string; target?: ToolTarget }
  | { status: "FAILED"; errorCode: string }
  | { status: "CONFIRMATION_REQUIRED"; affectedRecords: number };

/**
 * Records one completed tool call.
 *
 * Never throws — it inherits that contract from `logAudit()`, and it
 * matters for the same reason: a logging failure must not turn a
 * successful product update into a reported error.
 */
export async function recordToolCall(params: {
  tool: AnyToolDefinition;
  actor: McpActor;
  input: unknown;
  outcome: ToolOutcome;
  requestId: string;
  durationMs: number;
}): Promise<void> {
  const { tool, actor, outcome, requestId, durationMs } = params;

  // Safe observability for every call, read or write (section 12B.13):
  // who, which tool, what happened, how long. No arguments here — the
  // application log is the noisiest surface and the least access-
  // controlled, so argument values belong in the audit row instead.
  logger.info("mcp tool call", {
    requestId,
    tool: tool.name,
    kind: tool.kind,
    risk: tool.risk,
    actorId: actor.id,
    role: actor.role,
    status: outcome.status,
    durationMs,
  });

  // Module 43: metrics for EVERY call, read and write alike, and a
  // persisted row for every failure. This runs before the early return
  // below, which is the bug it fixes: until this module, a refusal on a
  // read tool was recorded nowhere a person could later look.
  await recordToolMetrics(params);

  if (tool.kind !== "write") return;

  const target = outcome.status === "SUCCESS" ? outcome.target : undefined;

  await logAudit({
    actorId: actor.id,
    action: `mcp.${tool.name}`,
    entityType: target?.type ?? null,
    entityId: target?.id ?? null,
    // `before` is left to the tool's own service call where one exists;
    // this row records the REQUEST and its outcome, which is the part
    // unique to the MCP path.
    after: {
      via: "mcp",
      requestId,
      role: actor.role,
      input: redactInput(params.input),
      outcome,
      durationMs,
    },
  });
}
