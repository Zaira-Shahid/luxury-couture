import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger";
import { notify } from "@/lib/notifications/notify";
import { productionStatusChangedTemplate, qcCompleteTemplate } from "@/lib/notifications/templates";
import { logAudit } from "@/lib/security/audit";
import type { WriteResult } from "@/lib/orders/write-orders";

import { QC_STAGE, checkProductionTransition } from "./transitions";

import type { ProductionStatus } from "@/types/database";

/**
 * Production WRITE services — Module 39.
 *
 * Extracted from `src/features/admin-production/actions.ts` for the
 * cookie-client reason recorded in `write-orders.ts`, and carrying the
 * history row and the customer notification with the write for the same
 * reason: a stage change nobody was told about is not the same event.
 *
 * One thing did NOT move. `advanceProductionStatus` never audited — it
 * wrote history but no `audit_logs` row, unlike its order equivalent.
 * That gap is filled here rather than preserved: 12B.7 requires every
 * MCP write to be auditable, and an audit trail that covers the order
 * pipeline but not the twelve stages the garment actually passes through
 * answers "who moved this" for half the journey.
 */

export type ProductionStatusChange = {
  productionOrderId: string;
  orderId: string;
  orderNumber: string | null;
  previousStatus: ProductionStatus;
  status: ProductionStatus;
  customerNotified: boolean;
};

async function loadJob(client: SupabaseClient, productionOrderId: string) {
  const { data } = await client
    .from("production_orders")
    .select("order_id, current_status")
    .eq("id", productionOrderId)
    .single();
  return data;
}

/**
 * Moves one production job to a later stage.
 *
 * `allowCorrection` has the meaning documented in `transitions.ts`: the
 * admin UI passes `true`, MCP does not.
 */
export async function advanceProductionStatusRecord(
  params: {
    productionOrderId: string;
    status: ProductionStatus;
    note?: string | null;
    actorId: string;
    allowCorrection?: boolean;
  },
  client: SupabaseClient
): Promise<WriteResult<ProductionStatusChange>> {
  const job = await loadJob(client, params.productionOrderId);
  if (!job) return { ok: false, error: "Production order not found." };

  const previousStatus = job.current_status as ProductionStatus;

  const check = checkProductionTransition(previousStatus, params.status, {
    allowCorrection: params.allowCorrection,
  });
  if (!check.ok) return { ok: false, error: check.reason };

  const { error: updateErr } = await client
    .from("production_orders")
    .update({ current_status: params.status })
    .eq("id", params.productionOrderId);

  if (updateErr) {
    logger.error("production status update failed", updateErr, {
      productionOrderId: params.productionOrderId,
    });
    return { ok: false, error: "Could not update production status. Please try again." };
  }

  await logAudit({
    action: "production.status_changed",
    entityType: "production_order",
    entityId: params.productionOrderId,
    before: { status: previousStatus },
    after: { status: params.status },
    // See write-orders.ts: the cookie fallback cannot identify a Bearer
    // caller.
    actorId: params.actorId,
  });

  await client.from("production_status_history").insert({
    production_order_id: params.productionOrderId,
    status: params.status,
    note: params.note ?? null,
    changed_by: params.actorId,
  });

  const { data: order } = await client
    .from("orders")
    .select("customer_id, order_number")
    .eq("id", job.order_id)
    .single();

  let customerNotified = false;
  if (order) {
    const template =
      params.status === QC_STAGE
        ? qcCompleteTemplate(order.order_number)
        : productionStatusChangedTemplate(order.order_number, params.status);

    const { inAppSuccess } = await notify(client, {
      profileId: order.customer_id,
      entityId: job.order_id,
      ...template,
    });
    customerNotified = inAppSuccess;
  }

  return {
    ok: true,
    data: {
      productionOrderId: params.productionOrderId,
      orderId: job.order_id,
      orderNumber: order?.order_number ?? null,
      previousStatus,
      status: params.status,
      customerNotified,
    },
  };
}

/**
 * Records a quality-check outcome WITHOUT moving the job.
 *
 * This is the shape the database was already designed for and nothing
 * had yet used. Migration 0054 gives `qc.write` its own INSERT policy on
 * `production_status_history`, separate from `production.write`, with the
 * comment: "a QC user must be able to record a result WITHOUT being able
 * to move the job through production themselves." So the outcome is a
 * history row at the CURRENT stage, not a column update — there is no
 * `qc_status` column, and adding one would duplicate a fact the history
 * table already holds.
 *
 * No customer notification. A failed inspection is an internal event; the
 * customer hears about the consequence — a delay, a remake — when
 * somebody decides what it is, not the moment a garment is set aside.
 */
export async function recordQcOutcomeRecord(
  params: {
    productionOrderId: string;
    passed: boolean;
    note: string;
    actorId: string;
  },
  client: SupabaseClient
): Promise<
  WriteResult<{
    productionOrderId: string;
    stage: ProductionStatus;
    passed: boolean;
    movedJob: false;
  }>
> {
  const job = await loadJob(client, params.productionOrderId);
  if (!job) return { ok: false, error: "Production order not found." };

  const stage = job.current_status as ProductionStatus;

  const { error } = await client.from("production_status_history").insert({
    production_order_id: params.productionOrderId,
    // The job's CURRENT stage, not `quality_check`. Writing the QC stage
    // here would make the history read as though the garment had moved
    // to inspection, which is a claim about where the work is, and this
    // call deliberately does not move it.
    status: stage,
    note: `Quality check ${params.passed ? "PASSED" : "FAILED"}: ${params.note}`,
    changed_by: params.actorId,
  });

  if (error) {
    logger.error("qc outcome record failed", error, {
      productionOrderId: params.productionOrderId,
    });
    return { ok: false, error: "Could not record this quality check. Please try again." };
  }

  await logAudit({
    action: "production.qc_recorded",
    entityType: "production_order",
    entityId: params.productionOrderId,
    after: { stage, passed: params.passed },
    actorId: params.actorId,
  });

  return {
    ok: true,
    data: { productionOrderId: params.productionOrderId, stage, passed: params.passed, movedJob: false },
  };
}

/**
 * Updates the schedule fields on a job.
 *
 * OMISSION IS NOT DELETION, the rule Module 38 established for the
 * catalogue editors. The admin form always posts both fields, so `""`
 * from a form honestly means "clear this". A tool call setting only the
 * team would otherwise wipe the completion date the workshop is planning
 * around.
 */
export async function updateProductionDetailsRecord(
  params: {
    productionOrderId: string;
    assignedTeam?: string | null;
    estimatedCompletionDate?: string | null;
  },
  client: SupabaseClient
): Promise<WriteResult<{ productionOrderId: string; orderId: string }>> {
  const job = await loadJob(client, params.productionOrderId);
  if (!job) return { ok: false, error: "Production order not found." };

  const patch: Record<string, string | null> = {};
  if (params.assignedTeam !== undefined) patch.assigned_team = params.assignedTeam || null;
  if (params.estimatedCompletionDate !== undefined) {
    patch.estimated_completion_date = params.estimatedCompletionDate || null;
  }

  if (Object.keys(patch).length === 0) {
    return { ok: false, error: "Nothing to update." };
  }

  const { error } = await client
    .from("production_orders")
    .update(patch)
    .eq("id", params.productionOrderId);

  if (error) {
    logger.error("production details update failed", error, {
      productionOrderId: params.productionOrderId,
    });
    return { ok: false, error: "Could not update these details. Please try again." };
  }

  return { ok: true, data: { productionOrderId: params.productionOrderId, orderId: job.order_id } };
}
