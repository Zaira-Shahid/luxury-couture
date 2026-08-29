import { revalidatePath } from "next/cache";
import { z } from "zod";

import { logger } from "@/lib/logger";
import type { WriteResult } from "@/lib/orders/write-orders";
import {
  advanceProductionStatusRecord,
  recordQcOutcomeRecord,
  updateProductionDetailsRecord,
} from "@/lib/production/write-production";
import { checkProductionTransition } from "@/lib/production/transitions";
import { PRODUCTION_STATUSES } from "@/lib/validations/production";

import type { ProductionStatus } from "@/types/database";

import type { McpContext } from "../context";
import { McpError } from "../errors";
import type { AnyToolDefinition } from "../registry";
import { uuid } from "./shared";

/**
 * Production WRITE tools — Module 39.
 *
 * THREE TOOLS, THREE PERMISSIONS, and the split is the interesting part.
 * `production_advance_status` moves the garment and takes
 * `production.write`. `production_record_qc` records an inspection result
 * and takes `qc.write`. They are separate because migration 0054 already
 * made them separate, with the comment "a QC user must be able to record
 * a result WITHOUT being able to move the job through production
 * themselves" — the database drew this line before any tool existed, and
 * a tool that folded QC into the status change would hand every QC user
 * the workshop.
 *
 * ADVANCING IS MEDIUM, NOT HIGH, which is the one place this module is
 * softer than `orders-write.ts`. A production stage is an internal fact
 * about where work has reached; the customer sees a progress line, not a
 * promise, and moving from `cutting` to `stitching` a day early is a
 * bookkeeping error rather than a broken commitment. Orders are different
 * because "shipped" is a claim about the outside world.
 *
 * FORWARD ONLY. The tools pass `allowCorrection: false`, so an assistant
 * can advance a job and skip stages the workshop genuinely skips, and
 * cannot send work backward. See `src/lib/production/transitions.ts`.
 */

const productionStatusEnum = z.enum(PRODUCTION_STATUSES);

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

type JobRow = { id: string; order_id: string; current_status: ProductionStatus };

/**
 * Reads the job through the caller's client so RLS decides visibility —
 * and this matters more here than in the order tools, because the
 * `production` role deliberately has no `orders.read` (0055). A job the
 * caller cannot see is NOT_FOUND, not "forbidden", so the tool cannot be
 * used to enumerate jobs.
 */
async function requireJob(id: string, ctx: McpContext): Promise<JobRow> {
  const { data } = await ctx.supabase
    .from("production_orders")
    .select("id, order_id, current_status")
    .eq("id", id)
    .maybeSingle();

  if (!data) throw new McpError("NOT_FOUND", "No production order with that id.");
  return data as JobRow;
}

function readable(status: string): string {
  return status.replace(/_/g, " ");
}

const productionAdvanceStatus: AnyToolDefinition = {
  name: "production_advance_status",
  title: "Advance a production job to a later stage",
  description:
    "Move a production job forward through the twelve-stage workshop pipeline. Stages may be " +
    "skipped — a piece with no embroidery goes straight from materials prepared to stitching — but " +
    "work can never be sent backward, which is rework and is recorded by a person. The customer " +
    "sees the new stage on their order timeline. It cannot cancel a job: an abandoned job is " +
    "cancelled on its ORDER, where the money is.",
  kind: "write",
  risk: "medium",
  permission: "production.write",
  inputSchema: z
    .object({
      id: uuid("The production order's id. This is not the order id."),
      status: productionStatusEnum.describe(
        "The stage to move to. Must be later in the pipeline than the job's current stage."
      ),
      note: z
        .string()
        .trim()
        .max(1000)
        .optional()
        .describe("Optional note shown to the customer on their order timeline."),
    })
    .strict(),
  handler: async (input, ctx) => {
    // Checked before the service runs so the refusal names the stage the
    // caller asked for rather than surfacing as a generic write failure.
    const job = await requireJob(input.id, ctx);
    const check = checkProductionTransition(job.current_status, input.status as ProductionStatus);
    if (!check.ok) throw new McpError("BUSINESS_RULE_ERROR", check.reason);

    const result = unwrap(
      await advanceProductionStatusRecord(
        {
          productionOrderId: input.id,
          status: input.status as ProductionStatus,
          note: input.note ?? null,
          actorId: ctx.actor.id,
          allowCorrection: false,
        },
        ctx.supabase
      )
    );

    revalidate([
      `/admin/production/${input.id}`,
      "/admin/production",
      `/account/orders/${result.orderId}`,
    ]);

    return {
      action: `Production advanced to ${readable(result.status)}`,
      target: { type: "production_order", id: input.id },
      data: result,
    };
  },
};

const productionRecordQc: AnyToolDefinition = {
  name: "production_record_qc",
  title: "Record a quality-check outcome",
  description:
    "Record the result of a quality inspection against a production job, with the finding. This " +
    "does NOT move the job: a pass does not advance it and a failure does not send it back — " +
    "deciding what happens next is a person's call, made with production_advance_status. The " +
    "customer is not notified; a failed inspection is internal until somebody decides what it means.",
  kind: "write",
  // Medium, not high. It writes a history row and moves nothing, so the
  // worst a wrong call does is record an inspection that did not happen —
  // corrected by recording the right one, and both remain in the history.
  risk: "medium",
  permission: "qc.write",
  inputSchema: z
    .object({
      id: uuid("The production order's id."),
      passed: z.boolean().describe("Whether the garment passed inspection."),
      note: z
        .string()
        .trim()
        .min(1, "Record what was checked or what failed — a bare pass/fail is not an inspection.")
        .max(1000)
        .describe("What was inspected, or what was wrong. Required for both outcomes."),
    })
    .strict(),
  handler: async (input, ctx) => {
    await requireJob(input.id, ctx);

    const result = unwrap(
      await recordQcOutcomeRecord(
        {
          productionOrderId: input.id,
          passed: input.passed,
          note: input.note,
          actorId: ctx.actor.id,
        },
        ctx.supabase
      )
    );

    revalidate([`/admin/production/${input.id}`, "/admin/production"]);

    return {
      action: `Quality check recorded as ${input.passed ? "passed" : "failed"}`,
      target: { type: "production_order", id: input.id },
      data: result,
    };
  },
};

const productionUpdateDetails: AnyToolDefinition = {
  name: "production_update_details",
  title: "Update a production job's team or target date",
  description:
    "Set the team assigned to a production job, its estimated completion date, or both. Omitting a " +
    "field leaves it unchanged; pass null to clear one. It cannot move the job between stages. " +
    "No customer notification is sent — the estimated date is internal planning.",
  kind: "write",
  risk: "medium",
  permission: "production.write",
  inputSchema: z
    .object({
      id: uuid("The production order's id."),
      assignedTeam: z
        .string()
        .trim()
        .max(200)
        .nullable()
        .optional()
        .describe("The team responsible. Omit to leave unchanged, null to clear."),
      estimatedCompletionDate: z
        .string()
        .trim()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.")
        .nullable()
        .optional()
        .describe("Target completion date as YYYY-MM-DD. Omit to leave unchanged, null to clear."),
    })
    .strict(),
  handler: async (input, ctx) => {
    await requireJob(input.id, ctx);

    // "Nothing to update" is caught here rather than in the service so
    // the caller learns it sent an empty edit, instead of getting a
    // success that changed nothing.
    if (input.assignedTeam === undefined && input.estimatedCompletionDate === undefined) {
      throw new McpError(
        "VALIDATION_ERROR",
        "Give at least one of assignedTeam or estimatedCompletionDate."
      );
    }

    const result = unwrap(
      await updateProductionDetailsRecord(
        {
          productionOrderId: input.id,
          assignedTeam: input.assignedTeam,
          estimatedCompletionDate: input.estimatedCompletionDate,
        },
        ctx.supabase
      )
    );

    revalidate([`/admin/production/${input.id}`, "/admin/production"]);

    return {
      action: "Production details updated",
      target: { type: "production_order", id: input.id },
      data: result,
    };
  },
};

export const productionWriteTools: AnyToolDefinition[] = [
  productionAdvanceStatus,
  productionRecordQc,
  productionUpdateDetails,
];
