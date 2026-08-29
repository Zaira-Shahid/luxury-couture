"use server";

import { revalidatePath } from "next/cache";

import { updateEnquiryStatusRecord } from "@/lib/enquiries/write-enquiries";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import type { EnquiryStatus } from "@/types/database";

export type ActionResult = { error: string } | { success: true };

const VALID_STATUSES: EnquiryStatus[] = ["new", "in_review", "quoted", "closed"];

export async function updateEnquiryStatus(id: string, status: EnquiryStatus): Promise<ActionResult> {
  if (!VALID_STATUSES.includes(status)) return { error: "Invalid status." };

  const supabase = await createClient();

  // allowCorrection — see admin-orders/actions.ts. This screen has always
  // let an admin pick any status, and Module 39 adds the pipeline rules
  // for MCP without removing that.
  const result = await updateEnquiryStatusRecord(
    { enquiryId: id, status, allowCorrection: true },
    supabase
  );
  if (!result.ok) return { error: result.error };

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
