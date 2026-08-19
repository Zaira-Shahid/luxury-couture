"use server";

import { revalidatePath } from "next/cache";

import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import { correctionRequestSchema } from "@/lib/validations/measurements";

export type ActionResult = { error: string } | { success: true };

export async function approveProfile(profileId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("measurement_profiles")
    .update({ status: "approved", admin_notes: null })
    .eq("id", profileId);

  if (error) {
    logger.error("measurement profile approve failed", error, { profileId });
    return { error: "Could not approve. Please try again." };
  }

  revalidatePath("/admin/measurements");
  revalidatePath(`/admin/measurements/${profileId}`);
  return { success: true };
}

export async function requestCorrection(profileId: string, formData: FormData): Promise<ActionResult> {
  const parsed = correctionRequestSchema.safeParse({ adminNotes: formData.get("adminNotes") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("measurement_profiles")
    .update({ status: "correction_requested", admin_notes: parsed.data.adminNotes })
    .eq("id", profileId);

  if (error) {
    logger.error("measurement correction request failed", error, { profileId });
    return { error: "Could not send correction request. Please try again." };
  }

  revalidatePath("/admin/measurements");
  revalidatePath(`/admin/measurements/${profileId}`);
  return { success: true };
}
