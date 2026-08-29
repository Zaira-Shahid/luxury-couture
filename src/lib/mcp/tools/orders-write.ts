import { revalidatePath } from "next/cache";
import { z } from "zod";

import { logger } from "@/lib/logger";
import {
  addOrderNoteRecord,
  updateOrderStatusRecord,
  type WriteResult,
} from "@/lib/orders/write-orders";
import { checkOrderTransition } from "@/lib/orders/transitions";
import { ORDER_STATUSES } from "@/lib/validations/orders";

import type { OrderStatus } from "@/types/database";

import { McpError } from "../errors";
import type { McpContext } from "../context";
import type { AnyToolDefinition } from "../registry";
import { uuid } from "./shared";

/**
 * Order WRITE tools — Module 39.
 *
 * A separate file from `orders.ts` for the reason Module 38 gave when it
 * split `catalog-write.ts` from `catalog.ts`: read and write is the axis
 * a security review cuts along, and the first tools that can change a
 * customer's order should be reviewable without reading past the readers.
 *
 * EVERY STATUS CHANGE IS HIGH RISK, which is a stronger line than the
 * catalogue takes. 12B.6 makes "publishing major content changes"
 * high-risk; an order status change is worse than that in one specific
 * way — it SENDS THE CUSTOMER AN EMAIL. A wrongly published product can
 * be unpublished and the damage is a few minutes of visibility; a
 * customer told their order shipped cannot be untold. Nothing here is
 * medium risk except the internal note, which no customer ever sees.
 *
 * THE PIPELINE IS ENFORCED, NOT SUGGESTED. `src/lib/orders/transitions.ts`
 * holds the rules and both doorways read them, but only this one is held
 * to them: the tools pass `allowCorrection: false`, so an assistant can
 * move an order forward and can cancel one that has not shipped, and can
 * do nothing else. Walking an order backward is a correction of a human
 * mistake, and an assistant cannot tell a mistake from an instruction.
 *
 * NO PAYMENTS. `orders.write` does not reach `payments`, and the Master
 * Build Plan puts payment status and refunds out of MCP scope until
 * explicitly authorised. Nothing in this file touches money.
 */

const orderStatusEnum = z.enum(ORDER_STATUSES);

/** See the identical helper in catalog-write.ts — never fatal. */
function revalidate(paths: string[]): void {
  for (const path of paths) {
    try {
      revalidatePath(path);
    } catch (error) {
      logger.warn("mcp revalidate failed", { path, message: String(error) });
    }
  }
}

function unwrap<T>(result: WriteResult<T>): T {
  if (!result.ok) throw new McpError("BUSINESS_RULE_ERROR", result.error);
  return result.data;
}

type OrderRow = { id: string; order_number: string; status: OrderStatus; customer_id: string };

/**
 * Reads the order through the CALLER'S client, so RLS decides what is
 * visible rather than this function deciding what to show. A row the
 * caller cannot see is NOT_FOUND, which is the same answer they would get
 * for an order that does not exist — deliberately, so the tool cannot be
 * used to probe which order numbers are real.
 */
async function requireOrder(id: string, ctx: McpContext): Promise<OrderRow> {
  const { data } = await ctx.supabase
    .from("orders")
    .select("id, order_number, status, customer_id")
    .eq("id", id)
    .maybeSingle();

  if (!data) throw new McpError("NOT_FOUND", "No order with that id.");
  return data as OrderRow;
}

function readable(status: string): string {
  return status.replace(/_/g, " ");
}

const ordersUpdateStatus: AnyToolDefinition = {
  name: "orders_update_status",
  title: "Move an order to a new status",
  description:
    "Move an order forward through its pipeline: pending, confirmed, in production, ready to ship, " +
    "shipped, delivered. Stages may be skipped but an order can never move backward — that is a " +
    "correction, which a person makes in the admin dashboard. Use orders_cancel to cancel. " +
    "The customer is notified of the new status, and an optional note appears on their order " +
    "timeline. Requires confirmation: the first call describes what would change and changes nothing.",
  kind: "write",
  risk: "high",
  permission: "orders.write",
  inputSchema: z
    .object({
      id: uuid("The order's id."),
      status: orderStatusEnum.describe(
        "The status to move to. Must be later in the pipeline than the order's current status. " +
          "Use orders_cancel rather than passing 'cancelled' here."
      ),
      note: z
        .string()
        .trim()
        .max(1000)
        .optional()
        .describe("Optional note shown to the CUSTOMER on their order timeline. Not an internal note."),
    })
    .strict(),
  describeImpact: async (input, ctx) => {
    const order = await requireOrder(input.id, ctx);

    // The transition is checked HERE as well as in the service, so an
    // illegal move is refused before an admin is asked to approve it.
    // Asking someone to confirm an action that will then be rejected
    // teaches them to click through confirmations.
    const check = checkOrderTransition(order.status, input.status as OrderStatus);
    if (!check.ok) throw new McpError("BUSINESS_RULE_ERROR", check.reason);

    return {
      summary:
        `Move order ${order.order_number} from ${readable(order.status)} to ` +
        `${readable(input.status)}. The customer will be emailed about this change.`,
      affectedRecords: 1,
    };
  },
  handler: async (input, ctx) => {
    const result = unwrap(
      await updateOrderStatusRecord(
        {
          orderId: input.id,
          status: input.status as OrderStatus,
          note: input.note ?? null,
          actorId: ctx.actor.id,
          // Never true here. See the file header.
          allowCorrection: false,
        },
        ctx.supabase
      )
    );

    revalidate([`/admin/orders/${input.id}`, "/admin/orders", `/account/orders/${input.id}`]);

    return {
      action: `Order moved to ${readable(result.status)}`,
      target: { type: "order", id: input.id },
      data: result,
    };
  },
};

const ordersCancel: AnyToolDefinition = {
  name: "orders_cancel",
  title: "Cancel an order",
  description:
    "Cancel an order that has not yet shipped. The customer is notified. A shipped order cannot be " +
    "cancelled — that is a return, which is handled outside this tool — and a cancelled order " +
    "cannot be reopened here. No refund is issued: this tool does not touch payments. " +
    "Requires confirmation: the first call describes what would be cancelled and changes nothing.",
  kind: "write",
  risk: "high",
  permission: "orders.write",
  inputSchema: z
    .object({
      id: uuid("The order's id."),
      reason: z
        .string()
        .trim()
        .min(1, "Give a reason — it is recorded on the order and shown to the customer.")
        .max(1000)
        .describe("Why the order is being cancelled. Recorded on the timeline and shown to the customer."),
    })
    .strict(),
  /**
   * A separate tool rather than a status on the editor, following the
   * rule Module 38 set with products_publish: a transition 12B.6 treats
   * as destructive gets its own tool, because `risk` is declared per tool
   * and one editor that could also cancel would be an unconfirmed
   * cancellation tool wearing a different name.
   *
   * It also takes a mandatory reason, which the status editor does not.
   * "Cancelled" with no explanation is the one status change a customer
   * always asks about.
   */
  describeImpact: async (input, ctx) => {
    const order = await requireOrder(input.id, ctx);

    const check = checkOrderTransition(order.status, "cancelled");
    if (!check.ok) throw new McpError("BUSINESS_RULE_ERROR", check.reason);

    return {
      summary:
        `Cancel order ${order.order_number}, currently ${readable(order.status)}. ` +
        `The customer will be notified. No refund is issued by this action.`,
      affectedRecords: 1,
    };
  },
  handler: async (input, ctx) => {
    const result = unwrap(
      await updateOrderStatusRecord(
        {
          orderId: input.id,
          status: "cancelled",
          note: input.reason,
          actorId: ctx.actor.id,
          allowCorrection: false,
        },
        ctx.supabase
      )
    );

    revalidate([`/admin/orders/${input.id}`, "/admin/orders", `/account/orders/${input.id}`]);

    return {
      action: "Order cancelled",
      target: { type: "order", id: input.id },
      data: result,
    };
  },
};

const ordersAddNote: AnyToolDefinition = {
  name: "orders_add_note",
  title: "Add an internal note to an order",
  description:
    "Record an internal note against an order. The note is visible to staff only and is never shown " +
    "to the customer — use the note on orders_update_status for anything the customer should see. " +
    "Adds a note; it cannot change the order or its status.",
  kind: "write",
  // The only medium-risk tool in this file. Nothing leaves the building,
  // nothing changes state a customer can observe, and a wrong note is
  // corrected by adding another one.
  risk: "medium",
  permission: "orders.write",
  inputSchema: z
    .object({
      id: uuid("The order's id."),
      note: z
        .string()
        .trim()
        .min(1, "The note cannot be empty.")
        .max(2000)
        .describe("The internal note. Staff-visible only."),
    })
    .strict(),
  handler: async (input, ctx) => {
    // Proves the order exists (and is visible to this caller) before
    // writing, so a bad id is NOT_FOUND rather than a foreign-key error
    // with a table name in it.
    await requireOrder(input.id, ctx);

    const result = unwrap(
      await addOrderNoteRecord(
        { orderId: input.id, note: input.note, actorId: ctx.actor.id },
        ctx.supabase
      )
    );

    revalidate([`/admin/orders/${input.id}`]);

    return {
      action: "Internal note added to order",
      target: { type: "order", id: input.id },
      data: result,
    };
  },
};

export const orderWriteTools: AnyToolDefinition[] = [
  ordersUpdateStatus,
  ordersCancel,
  ordersAddNote,
];
