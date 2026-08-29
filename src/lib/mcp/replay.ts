import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

/**
 * The confirmation replay ledger (Module 38, migration 0063).
 *
 * Module 36 shipped stateless HMAC confirmation tokens and recorded the
 * honest cost in Master Build Plan 12B.14: a token is single-ACTION but
 * not single-USE, so within its five-minute life the same confirmed
 * action could execute twice. That was harmless while no high-risk tool
 * existed. `products_archive` and `products_publish` arrive with this
 * module, so it stops being harmless here.
 *
 * CONSUME BEFORE ACTING. The dispatcher spends the token first and runs
 * the action second. Doing it the other way — act, then record — would
 * leave a window where two concurrent calls both pass the check and both
 * write, which is precisely the failure the ledger exists to prevent.
 * The unique constraint is what decides the race, not application timing.
 *
 * SERVICE-ROLE, and this is the third place on the MCP path that reaches
 * for it, alongside the audit write and the rate limiter (12B.2). The
 * table has RLS enabled with no write policy at all, because a ledger an
 * administrator could delete from is a ledger an administrator could
 * defeat — and constraining what a confirmed admin action can do twice
 * is the entire purpose. It takes no AI-supplied input: the signature
 * written here is one the server computed itself.
 */

export type ConsumeOutcome = "consumed" | "already-used" | "unavailable";

/** Postgres unique_violation — someone already spent this token. */
const UNIQUE_VIOLATION = "23505";

/**
 * Records a token as spent.
 *
 * Only the SIGNATURE half of `<expiry>.<hmac>` is stored. The signature
 * identifies the token uniquely, and storing the assembled token would
 * put a still-valid credential in a database row.
 *
 * Returns `unavailable` rather than throwing when the ledger itself
 * errors, so the dispatcher can fail the action closed: an action whose
 * replay protection is not working must not run, because "we could not
 * check" and "this is the first use" are not the same claim.
 */
export async function consumeConfirmation(params: {
  token: string;
  actorId: string;
  toolName: string;
}): Promise<ConsumeOutcome> {
  const separator = params.token.indexOf(".");
  const signature = separator > 0 ? params.token.slice(separator + 1) : params.token;
  if (!signature) return "unavailable";

  try {
    const admin = createAdminClient();
    const { error } = await admin.from("mcp_confirmations").insert({
      signature,
      actor_id: params.actorId,
      tool_name: params.toolName,
    });

    if (!error) return "consumed";
    if (error.code === UNIQUE_VIOLATION) return "already-used";

    logger.error("mcp confirmation ledger write failed", error, { tool: params.toolName });
    return "unavailable";
  } catch (error) {
    logger.error("mcp confirmation ledger unreachable", error, { tool: params.toolName });
    return "unavailable";
  }
}
