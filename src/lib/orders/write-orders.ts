import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger";
import { notify } from "@/lib/notifications/notify";
import { orderConfirmedTemplate, orderStatusChangedTemplate } from "@/lib/notifications/templates";
import { logAudit } from "@/lib/security/audit";

import { checkOrderTransition } from "./transitions";

import type { OrderStatus } from "@/types/database";

/**
 * Order WRITE services — Module 39.
 *
 * Extracted from `src/features/admin-orders/actions.ts` for the reasons
 * Module 38 recorded when it extracted the catalogue writers (12B.11):
 * the action builds its client from request COOKIES, which a Bearer MCP
 * call does not carry, so every write would have run anonymously and
 * been refused by RLS. The client is a parameter here.
 *
 * WHAT THE ACTION KEEPS: `revalidatePath`. Which paths need busting
 * differs per caller, and Next's cache is a framework concern rather
 * than a domain one.
 *
 * WHAT MOVED WITH THE WRITE, deliberately: the audit row, the status
 * history row and the customer notification. All three are part of what
 * "changing an order's status" MEANS in this business — an order whose
 * status changed without a history entry is a bug, not a variant — and
 * leaving them in the action would have let an MCP status change happen
 * silently, with the customer never told.
 */

export type WriteResult<T> = { ok: true; data: T } | { ok: false; error: string };

export type OrderStatusChange = {
  orderId: string;
  orderNumber: string;
  previousStatus: OrderStatus;
  status: OrderStatus;
  customerNotified: boolean;
};

/**
 * Moves one order to a new status.
 *
 * `allowCorrection` is passed straight to `checkOrderTransition`, and the
 * asymmetry it creates is documented there: the admin UI passes `true`
 * and keeps the freedom it has always had, MCP passes `false` and is held
 * to the pipeline.
 *
 * `actorId` is required rather than read from the session, because there
 * are now two kinds of session and only the caller knows which it is in.
 */
export async function updateOrderStatusRecord(
  params: {
    orderId: string;
    status: OrderStatus;
    note?: string | null;
    actorId: string;
    allowCorrection?: boolean;
  },
  client: SupabaseClient
): Promise<WriteResult<OrderStatusChange>> {
  const { data: order } = await client
    .from("orders")
    .select("customer_id, order_number, status")
    .eq("id", params.orderId)
    .single();

  if (!order) return { ok: false, error: "Order not found." };

  const previousStatus = order.status as OrderStatus;

  const check = checkOrderTransition(previousStatus, params.status, {
    allowCorrection: params.allowCorrection,
  });
  if (!check.ok) return { ok: false, error: check.reason };

  const { error: updateErr } = await client
    .from("orders")
    .update({ status: params.status })
    .eq("id", params.orderId);

  if (updateErr) {
    logger.error("order status update failed", updateErr, { orderId: params.orderId });
    return { ok: false, error: "Could not update this order. Please try again." };
  }

  await logAudit({
    action: "order.status_changed",
    entityType: "order",
    entityId: params.orderId,
    before: { status: previousStatus },
    after: { status: params.status },
    // Passed explicitly. Without it logAudit falls back to reading the
    // session from COOKIES, which an MCP Bearer call does not carry —
    // the audit row would name nobody for exactly the caller most worth
    // recording.
    actorId: params.actorId,
  });

  await client.from("order_status_history").insert({
    order_id: params.orderId,
    status: params.status,
    note: params.note ?? null,
    changed_by: params.actorId,
  });

  const template =
    params.status === "confirmed"
      ? orderConfirmedTemplate(order.order_number)
      : orderStatusChangedTemplate(order.order_number, params.status);

  const { inAppSuccess } = await notify(client, {
    profileId: order.customer_id,
    entityId: params.orderId,
    ...template,
  });

  return {
    ok: true,
    data: {
      orderId: params.orderId,
      orderNumber: order.order_number,
      previousStatus,
      status: params.status,
      // Reported rather than enforced. A notification that failed to
      // send must not un-change a status that is already changed —
      // that would be 12B.8's "reported a successful write as a
      // failure" — but the caller should be able to say so.
      customerNotified: inAppSuccess,
    },
  };
}

/**
 * Adds an internal note to an order.
 *
 * Internal is the operative word: `order_notes` is admin-only by RLS and
 * never reaches the customer, unlike the `note` on a status change, which
 * appears on their order timeline. The two are easy to confuse and the
 * tool descriptions say which is which.
 */
export async function addOrderNoteRecord(
  params: { orderId: string; note: string; actorId: string },
  client: SupabaseClient
): Promise<WriteResult<{ orderId: string; noteId: string }>> {
  const { data: order } = await client
    .from("orders")
    .select("id")
    .eq("id", params.orderId)
    .maybeSingle();

  if (!order) return { ok: false, error: "Order not found." };

  const { data, error } = await client
    .from("order_notes")
    .insert({
      order_id: params.orderId,
      note: params.note,
      created_by: params.actorId,
    })
    .select("id")
    .single();

  if (error || !data) {
    logger.error("order note creation failed", error, { orderId: params.orderId });
    return { ok: false, error: "Could not save this note. Please try again." };
  }

  return { ok: true, data: { orderId: params.orderId, noteId: data.id } };
}
