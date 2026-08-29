"use server";

import { revalidatePath } from "next/cache";

import { getAuthUser } from "@/lib/auth/session";
import {
  advanceProductionStatusRecord,
  updateProductionDetailsRecord,
} from "@/lib/production/write-production";
import { createClient } from "@/lib/supabase/server";
import { advanceProductionStatusSchema, updateProductionDetailsSchema } from "@/lib/validations/production";

export type ActionResult = { error: string } | { success: true };

/**
 * production_orders/production_status_history are admin- or
 * production-role-write-only by RLS (0034) — this relies entirely on
 * that, same pattern as updateOrderStatus (Module 12).
 */
export async function advanceProductionStatus(productionOrderId: string, formData: FormData): Promise<ActionResult> {
  const parsed = advanceProductionStatusSchema.safeParse({
    status: formData.get("status"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const supabase = await createClient();
  const user = await getAuthUser();
  if (!user) return { error: "You must be signed in." };

  // allowCorrection — see the same call in admin-orders/actions.ts. A
  // supervisor correcting a mis-tap on the workshop floor keeps the
  // freedom this form has always given them.
  const result = await advanceProductionStatusRecord(
    {
      productionOrderId,
      status: parsed.data.status,
      note: parsed.data.note ?? null,
      actorId: user.id,
      allowCorrection: true,
    },
    supabase
  );
  if (!result.ok) return { error: result.error };

  revalidatePath(`/admin/production/${productionOrderId}`);
  revalidatePath(`/account/orders/${result.data.orderId}`);
  return { success: true };
}

export async function updateProductionDetails(productionOrderId: string, formData: FormData): Promise<ActionResult> {
  const parsed = updateProductionDetailsSchema.safeParse({
    assignedTeam: formData.get("assignedTeam") || undefined,
    estimatedCompletionDate: formData.get("estimatedCompletionDate") || undefined,
  });
  if (!parsed.success) return { error: "Invalid input." };

  const supabase = await createClient();

  // The form always posts both fields, so `?? null` here preserves its
  // "blank means clear" behaviour exactly. A tool omitting a field means
  // something different, which is why the service distinguishes
  // undefined from null rather than this call site doing it.
  const result = await updateProductionDetailsRecord(
    {
      productionOrderId,
      assignedTeam: parsed.data.assignedTeam ?? null,
      estimatedCompletionDate: parsed.data.estimatedCompletionDate ?? null,
    },
    supabase
  );
  if (!result.ok) return { error: result.error };

  revalidatePath(`/admin/production/${productionOrderId}`);
  revalidatePath(`/account/orders/${result.data.orderId}`);
  return { success: true };
}
