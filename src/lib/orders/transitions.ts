import { ORDER_STATUSES } from "@/lib/validations/orders";

import type { OrderStatus } from "@/types/database";

/**
 * Order status transition rules — Module 39.
 *
 * WRITTEN HERE, NOT FOUND. The Master Build Plan said Module 39 should
 * "go through the existing workflow validation" rather than write a
 * status column directly. There was none to go through. `orders.status`
 * is validated in three places and none of them is a workflow:
 * `updateOrderStatusSchema` checks enum membership, the `orders` table's
 * CHECK constraint checks the same thing again, and the admin dropdown
 * lists every status unconditionally. Nothing anywhere asks whether the
 * move from the CURRENT status makes sense, so today a delivered order
 * can be walked back to pending.
 *
 * That was survivable while a human with context was the only caller. An
 * assistant has no context, and 12B.6's whole premise is that a tool must
 * not be able to do something the business would not do. So the rules are
 * defined here, once, and both doorways read them.
 *
 * A LINEAR PIPELINE WITH SKIPS. Orders move forward through the sequence
 * below. Skipping ahead is allowed because the business genuinely does it
 * — a ready-to-wear piece goes from `confirmed` to `ready_to_ship`
 * without ever entering production — but moving BACKWARD is not a
 * workflow step, it is a correction of a mistake, and the two need
 * different permission to happen.
 */

/**
 * The forward order of the pipeline. `cancelled` is deliberately NOT in
 * it: cancellation is an exit from the pipeline at almost any point, not
 * a stage that follows another one, and putting it in a sequence would
 * make "cancelled -> delivered" look like a forward step.
 */
export const ORDER_STATUS_SEQUENCE = [
  "pending",
  "confirmed",
  "in_production",
  "ready_to_ship",
  "shipped",
  "delivered",
] as const satisfies readonly OrderStatus[];

/**
 * States nothing follows. `delivered` is the pipeline's end and
 * `cancelled` is its exit; an order in either is finished, and a tool
 * that could reopen one could undo a refund decision or resurrect an
 * order a customer was told was cancelled.
 */
export const TERMINAL_ORDER_STATUSES = ["delivered", "cancelled"] as const satisfies readonly OrderStatus[];

/**
 * The last point at which cancelling is still a business action rather
 * than a returns problem. Once the parcel is with the courier,
 * "cancelled" is the wrong word for what happened, and the shipping and
 * refund flows that would have to run are not in this module's scope.
 */
const LAST_CANCELLABLE = "ready_to_ship" satisfies OrderStatus;

export type TransitionCheck = { ok: true } | { ok: false; reason: string };

function position(status: OrderStatus): number {
  return (ORDER_STATUS_SEQUENCE as readonly string[]).indexOf(status);
}

export function isTerminalOrderStatus(status: OrderStatus): boolean {
  return (TERMINAL_ORDER_STATUSES as readonly string[]).includes(status);
}

/**
 * Every status this order could legitimately move to next.
 *
 * Exported because a tool that only ever says "no" is useless to an
 * assistant — `orders_get` can advertise the legal next steps, so the
 * model proposes one of them instead of guessing and being refused.
 */
export function allowedOrderTransitions(from: OrderStatus): OrderStatus[] {
  if (isTerminalOrderStatus(from)) return [];

  const forward = ORDER_STATUS_SEQUENCE.filter((s) => position(s) > position(from));
  const cancellable = position(from) <= position(LAST_CANCELLABLE);

  return cancellable ? [...forward, "cancelled"] : [...forward];
}

/**
 * Whether `to` may follow `from`.
 *
 * `allowCorrection` exists for one caller and one reason. The admin UI
 * has always let a human pick any status, and a human staring at the
 * order they just mis-clicked is exactly who should be able to put it
 * back. Refusing that here would be this module removing a capability the
 * business has, in the name of a rule written for assistants. So the UI
 * passes `true` and keeps working as it always has; MCP passes `false`
 * and gets the rules. The asymmetry is the point, not an oversight:
 * a correction is a human judgement about a mistake, and an assistant has
 * no way to tell a mistake from an instruction.
 */
export function checkOrderTransition(
  from: OrderStatus,
  to: OrderStatus,
  options: { allowCorrection?: boolean } = {}
): TransitionCheck {
  if (from === to) {
    return { ok: false, reason: `This order is already ${to.replace(/_/g, " ")}.` };
  }

  if (!(ORDER_STATUSES as readonly string[]).includes(to)) {
    return { ok: false, reason: `${to} is not an order status.` };
  }

  if (options.allowCorrection) return { ok: true };

  if (isTerminalOrderStatus(from)) {
    return {
      ok: false,
      reason:
        `This order is ${from.replace(/_/g, " ")}, which is final. ` +
        `Reopening it is a decision for a person, not a tool.`,
    };
  }

  if (to === "cancelled") {
    return position(from) <= position(LAST_CANCELLABLE)
      ? { ok: true }
      : {
          ok: false,
          reason:
            "This order has already shipped, so it cannot be cancelled. " +
            "A shipped order that comes back is a return, which is handled separately.",
        };
  }

  if (position(to) <= position(from)) {
    return {
      ok: false,
      reason:
        `An order cannot move from ${from.replace(/_/g, " ")} back to ${to.replace(/_/g, " ")}. ` +
        `Allowed next: ${allowedOrderTransitions(from).join(", ") || "none"}.`,
    };
  }

  return { ok: true };
}
