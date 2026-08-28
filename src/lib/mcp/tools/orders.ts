import { z } from "zod";

import { getAdminOrderDetail, getAdminOrders } from "@/lib/orders/get-orders";

import { McpError } from "../errors";
import { paginate, paginationShape } from "../paginate";
import type { AnyToolDefinition } from "../registry";
import { readerOptions, uuid } from "./shared";

/**
 * Order read tools — Module 37.
 *
 * Both take `orders.read`, which is the permission `/admin/orders`
 * already requires. The rule for every tool in this module is that a tool
 * takes the permission its admin page takes: MCP is a second doorway to
 * the same capability, so a different key would describe a capability the
 * admin UI cannot express.
 */

const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "in_production",
  "ready_to_ship",
  "shipped",
  "delivered",
  "cancelled",
] as const;

/**
 * The list row. Deliberately narrower than the `orders` table: an
 * assistant answering "what's outstanding?" needs the number, the state
 * and the value, not the internal address/quotation/coupon foreign keys
 * or the free-text notes field.
 */
function listRow(order: Awaited<ReturnType<typeof getAdminOrders>>[number]) {
  return {
    id: order.id,
    orderNumber: order.order_number,
    status: order.status,
    customerName: order.profiles?.full_name ?? null,
    total: Number(order.total_amount),
    balanceDue: Number(order.balance_due_amount),
    currency: order.currency,
    createdAt: order.created_at,
  };
}

const ordersList: AnyToolDefinition = {
  name: "orders_list",
  title: "List orders",
  description:
    "List customer orders, newest first, optionally filtered by status. Returns a summary row per " +
    "order — number, status, customer name, total and balance due. Use orders_get for the full " +
    "detail of one order. Reads only; it cannot change an order or its status.",
  kind: "read",
  risk: "low",
  permission: "orders.read",
  inputSchema: z
    .object({
      status: z
        .enum(ORDER_STATUSES)
        .optional()
        .describe("Only return orders in this state. Omit for all states."),
      ...paginationShape,
    })
    .strict(),
  handler: async (input, ctx) => {
    const all = await getAdminOrders(readerOptions(ctx));
    const filtered = input.status ? all.filter((o) => o.status === input.status) : all;
    const page = paginate(filtered.map(listRow), input);

    return {
      action: input.status ? `Listed ${input.status} orders` : "Listed orders",
      data: page,
    };
  },
};

const ordersGet: AnyToolDefinition = {
  name: "orders_get",
  title: "Get an order",
  description:
    "Get one order in full by its id: totals, line items, payment records, status history, and the " +
    "linked production and shipping records. Does NOT return the private internal notes staff " +
    "leave on an order, or payment provider references. Reads only; it cannot change anything.",
  kind: "read",
  risk: "low",
  permission: "orders.read",
  inputSchema: z.object({ id: uuid("The order's id.") }).strict(),
  handler: async (input, ctx) => {
    const detail = await getAdminOrderDetail(input.id, readerOptions(ctx));
    if (!detail) throw new McpError("NOT_FOUND", "That order could not be found.");

    return {
      action: "Retrieved order",
      target: { type: "order", id: detail.order.id },
      data: {
        order: {
          id: detail.order.id,
          orderNumber: detail.order.order_number,
          status: detail.order.status,
          subtotal: Number(detail.order.subtotal),
          discount: Number(detail.order.discount_amount),
          total: Number(detail.order.total_amount),
          depositDue: Number(detail.order.deposit_amount),
          depositPaid: Number(detail.order.deposit_paid_amount),
          balanceDue: Number(detail.order.balance_due_amount),
          currency: detail.order.currency,
          createdAt: detail.order.created_at,
        },
        customerName: detail.customer?.full_name ?? null,
        items: detail.items.map((item) => ({
          description: item.description_snapshot,
          quantity: item.quantity,
        })),
        // Amount, type and state only. `provider_reference` is the
        // provider's own identifier for the charge and has no business
        // meaning to an assistant, so it is not returned.
        payments: detail.payments.map((payment) => ({
          type: payment.type,
          status: payment.status,
          amount: Number(payment.amount),
          currency: payment.currency,
          paidAt: payment.paid_at,
        })),
        statusHistory: detail.statusHistory.map((entry) => ({
          status: entry.status,
          changedAt: entry.created_at,
        })),
        production: detail.production
          ? { id: detail.production.id, status: detail.production.current_status }
          : null,
        shipping: detail.shipping
          ? { status: detail.shipping.status, trackingNumber: detail.shipping.tracking_number }
          : null,
      },
    };
  },
};

export const orderTools: AnyToolDefinition[] = [ordersList, ordersGet];
