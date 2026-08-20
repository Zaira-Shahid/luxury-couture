"use server";

import { revalidatePath } from "next/cache";

import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import type { EnquiryStatus } from "@/types/database";

export type ActionResult = { error: string } | { success: true };

const VALID_STATUSES: EnquiryStatus[] = ["new", "in_review", "quoted", "closed"];

export async function updateEnquiryStatus(id: string, status: EnquiryStatus): Promise<ActionResult> {
  if (!VALID_STATUSES.includes(status)) return { error: "Invalid status." };

  const supabase = await createClient();
  const { error } = await supabase.from("enquiries").update({ status }).eq("id", id);

  if (error) {
    logger.error("enquiry status update failed", error, { id });
    return { error: "Could not update. Please try again." };
  }

  revalidatePath("/admin/enquiries");
  revalidatePath(`/admin/enquiries/${id}`);
  return { success: true };
}

export async function assignEnquiryToSelf(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { error } = await supabase.from("enquiries").update({ assigned_admin_id: user.id }).eq("id", id);

  if (error) {
    logger.error("enquiry assign failed", error, { id });
    return { error: "Could not assign. Please try again." };
  }

  revalidatePath("/admin/enquiries");
  revalidatePath(`/admin/enquiries/${id}`);
  return { success: true };
}
