"use server";

import { revalidatePath } from "next/cache";

import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { error: string } | { success: true };

export async function markNotificationRead(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("profile_id", user.id);

  if (error) {
    logger.error("mark notification read failed", error, { id });
    return { error: "Could not update this notification." };
  }

  revalidatePath("/account/notifications");
  return { success: true };
}
