import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { Appointment } from "@/types/database";

/** The signed-in customer's own appointments. */
export async function getMyAppointments(): Promise<Appointment[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .eq("customer_id", user.id)
    .order("scheduled_at", { ascending: true });

  if (error) {
    logger.warn("failed to load appointments", { message: error.message });
    return [];
  }
  return (data ?? []) as Appointment[];
}
