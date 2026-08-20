"use server";

import { revalidatePath } from "next/cache";

import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import type { AppointmentStatus } from "@/types/database";

export type ActionResult = { error: string } | { success: true };

const VALID_STATUSES: AppointmentStatus[] = [
  "requested",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
];

export async function updateAppointmentStatus(
  id: string,
  status: AppointmentStatus
): Promise<ActionResult> {
  if (!VALID_STATUSES.includes(status)) return { error: "Invalid status." };

  const supabase = await createClient();
  const { error } = await supabase.from("appointments").update({ status }).eq("id", id);

  if (error) {
    logger.error("appointment status update failed", error, { id });
    return { error: "Could not update. Please try again." };
  }

  revalidatePath("/admin/appointments");
  revalidatePath(`/admin/appointments/${id}`);
  return { success: true };
}
