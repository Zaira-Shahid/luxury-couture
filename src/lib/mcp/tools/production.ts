import { z } from "zod";

import {
  getAdminProductionOrders,
  getProductionOrderDetail,
} from "@/lib/production/get-production";

import { McpError } from "../errors";
import { paginate, paginationShape } from "../paginate";
import type { AnyToolDefinition } from "../registry";
import { readerOptions, uuid } from "./shared";

/**
 * Production read tools — Module 37.
 *
 * `production.read`, the key `/admin/production` requires. Note that RLS
 * (migration 0034) scopes `production_orders` to admin and
 * production-role accounts on top of this, so the permission check and
 * the policy agree rather than one standing in for the other.
 */

const PRODUCTION_STATUSES = [
  "order_confirmed",
  "measurements_verified",
  "design_approved",
  "materials_prepared",
  "cutting",
  "embroidery",
  "stitching",
  "finishing",
  "quality_check",
  "ready_for_dispatch",
  "shipped",
  "delivered",
] as const;

const productionList: AnyToolDefinition = {
  name: "production_list",
  title: "List production orders",
  description:
    "List garments in production, newest first, optionally filtered by production stage. Returns " +
    "the stage, the assigned team and the estimated completion date for each. Use production_get " +
    "for one order's full stage history. Reads only; it cannot advance a stage.",
  kind: "read",
  risk: "low",
  permission: "production.read",
  inputSchema: z
    .object({
      status: z
        .enum(PRODUCTION_STATUSES)
        .optional()
        .describe("Only return orders at this stage. Omit for all stages."),
      ...paginationShape,
    })
    .strict(),
  handler: async (input, ctx) => {
    const all = await getAdminProductionOrders(readerOptions(ctx));
    const filtered = input.status ? all.filter((row) => row.current_status === input.status) : all;

    const page = paginate(
      filtered.map((row) => ({
        id: row.id,
        orderId: row.order_id,
        orderNumber: row.orders?.order_number ?? null,
        status: row.current_status,
        assignedTeam: row.assigned_team,
        estimatedCompletionDate: row.estimated_completion_date,
        createdAt: row.created_at,
      })),
      input
    );

    return {
      action: input.status ? `Listed production orders at ${input.status}` : "Listed production orders",
      data: page,
    };
  },
};

const productionGet: AnyToolDefinition = {
  name: "production_get",
  title: "Get a production order",
  description:
    "Get one production order by its id, with its full stage history and the note recorded at each " +
    "stage change. Reads only; it cannot advance a stage or change a status.",
  kind: "read",
  risk: "low",
  permission: "production.read",
  inputSchema: z.object({ id: uuid("The production order's id.") }).strict(),
  handler: async (input, ctx) => {
    const detail = await getProductionOrderDetail(input.id, readerOptions(ctx));
    if (!detail) throw new McpError("NOT_FOUND", "That production order could not be found.");

    return {
      action: "Retrieved production order",
      target: { type: "production_order", id: detail.production.id },
      data: {
        id: detail.production.id,
        status: detail.production.current_status,
        assignedTeam: detail.production.assigned_team,
        estimatedCompletionDate: detail.production.estimated_completion_date,
        createdAt: detail.production.created_at,
        order: detail.order ? { id: detail.order.id, orderNumber: detail.order.order_number } : null,
        history: detail.history.map((entry) => ({
          status: entry.status,
          note: entry.note,
          changedAt: entry.created_at,
        })),
      },
    };
  },
};

export const productionTools: AnyToolDefinition[] = [productionList, productionGet];
