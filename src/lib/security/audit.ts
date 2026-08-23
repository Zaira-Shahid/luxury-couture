import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

/**
 * Writes a row to `audit_logs`.
 *
 * MODULE 29 FINDING: the table has existed since `0012` and, until this
 * module, **nothing in the application wrote to it**. There was no record
 * of who changed a price, issued a refund, or altered someone's role —
 * which is precisely the set of questions an audit log exists to answer.
 *
 * DELIBERATELY NARROW. This is called from the mutations where "who did
 * this, and what did it used to be" is a question someone will actually
 * ask: money, roles, order state, and settings. Logging every write would
 * produce a table nobody reads and a second copy of the database, and the
 * signal would be worse, not better.
 *
 * Uses the SERVICE-ROLE client on purpose. `audit_logs` is admin-only for
 * all operations (0012), so an audit entry written through the caller's
 * own client would fail for exactly the callers most worth recording —
 * and a log that a user can suppress by lacking permission is not a log.
 *
 * NEVER THROWS. An audit write must not be able to fail the operation it
 * describes: refusing a legitimate refund because a logging insert timed
 * out would be a worse outcome than the missing row. Failures are logged
 * to the application log instead, which is the honest trade and is stated
 * here so nobody mistakes silence for "it definitely recorded".
 */
export async function logAudit(params: {
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  /** Pass when the caller already has it, to save a lookup. */
  actorId?: string | null;
}): Promise<void> {
  try {
    let actorId = params.actorId ?? null;
    if (!actorId) {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      actorId = user?.id ?? null;
    }

    const admin = createAdminClient();
    const { error } = await admin.from("audit_logs").insert({
      actor_id: actorId,
      action: params.action,
      entity_type: params.entityType ?? null,
      entity_id: params.entityId ?? null,
      before: params.before === undefined ? null : params.before,
      after: params.after === undefined ? null : params.after,
    });

    if (error) {
      logger.warn("audit log write failed", { action: params.action, message: error.message });
    }
  } catch (error) {
    logger.warn("audit log write threw", {
      action: params.action,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
