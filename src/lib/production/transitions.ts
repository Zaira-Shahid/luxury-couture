import { PRODUCTION_STATUSES } from "@/lib/validations/production";

import type { ProductionStatus } from "@/types/database";
import type { TransitionCheck } from "@/lib/orders/transitions";

/**
 * Production status transition rules — Module 39.
 *
 * The same absence documented in `src/lib/orders/transitions.ts` applies
 * here, and matters more. Production is a twelve-stage physical pipeline
 * (section 13); `advanceProductionStatus` is named "advance" but does not
 * advance anything — it writes whatever status it is handed. A garment at
 * `finishing` could be sent back to `cutting` by a tool call, and the
 * customer would be notified that their order had regressed by six
 * stages.
 *
 * FORWARD ONLY, SKIPS ALLOWED. A workshop legitimately skips stages — a
 * piece with no embroidery goes from `materials_prepared` to `stitching`
 * — so a strict next-stage-only rule would refuse real work. Going
 * backward is not a stage, it is rework or a correction, and neither is
 * something an assistant should decide.
 *
 * NO CANCELLATION EXIT, unlike orders. `production_orders` has no
 * cancelled state; an abandoned job is handled on the ORDER, which is
 * where the customer relationship and the money live. A tool that could
 * cancel a production job without touching its order would leave the two
 * disagreeing.
 */

/**
 * The pipeline in order. This is `PRODUCTION_STATUSES` itself rather than
 * a second copy — the validation array already IS the sequence, in the
 * right order, and two lists that must agree eventually will not.
 */
export const PRODUCTION_STATUS_SEQUENCE = PRODUCTION_STATUSES;

/**
 * The stage at which a garment is inspected. Named because the QC tools
 * key off it: a QC outcome is recorded AT this stage without moving the
 * job, which is why `qc.write` exists separately from `production.write`
 * (migration 0054).
 */
export const QC_STAGE = "quality_check" satisfies ProductionStatus;

/** Nothing follows delivery. */
export const TERMINAL_PRODUCTION_STATUS = "delivered" satisfies ProductionStatus;

function position(status: ProductionStatus): number {
  return (PRODUCTION_STATUS_SEQUENCE as readonly string[]).indexOf(status);
}

/**
 * Every stage this job could legitimately move to next, so a tool can
 * advertise them rather than leaving an assistant to guess and be
 * refused.
 */
export function allowedProductionTransitions(from: ProductionStatus): ProductionStatus[] {
  return PRODUCTION_STATUS_SEQUENCE.filter((s) => position(s) > position(from));
}

/**
 * Whether `to` may follow `from`.
 *
 * `allowCorrection` carries the same meaning and the same caller split as
 * the order rules: the admin UI has always allowed any stage to be
 * chosen, and a supervisor correcting a mis-tap is the reason it should
 * keep doing so. MCP passes `false`. See `checkOrderTransition` for why
 * the asymmetry is deliberate.
 */
export function checkProductionTransition(
  from: ProductionStatus,
  to: ProductionStatus,
  options: { allowCorrection?: boolean } = {}
): TransitionCheck {
  if (from === to) {
    return { ok: false, reason: `This job is already at ${to.replace(/_/g, " ")}.` };
  }

  if (!(PRODUCTION_STATUS_SEQUENCE as readonly string[]).includes(to)) {
    return { ok: false, reason: `${to} is not a production stage.` };
  }

  if (options.allowCorrection) return { ok: true };

  if (from === TERMINAL_PRODUCTION_STATUS) {
    return {
      ok: false,
      reason: "This job is delivered, which is final. Reopening it is a decision for a person, not a tool.",
    };
  }

  if (position(to) < position(from)) {
    return {
      ok: false,
      reason:
        `Production cannot move from ${from.replace(/_/g, " ")} back to ${to.replace(/_/g, " ")}. ` +
        `Sending work backward is rework, which a person records with a note. ` +
        `Allowed next: ${allowedProductionTransitions(from).join(", ") || "none"}.`,
    };
  }

  return { ok: true };
}
