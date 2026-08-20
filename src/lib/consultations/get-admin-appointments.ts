import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { Appointment, AppointmentStatus } from "@/types/database";

/** Admin-only: every appointment, optionally filtered by status. */
export async function getAdminAppointments(status?: AppointmentStatus): Promise<Appointment[]> {
  const supabase = await createClient();
  let query = supabase.from("appointments").select("*").order("scheduled_at", { ascending: true });
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) {
    logger.warn("failed to load admin appointments", { message: error.message });
    return [];
  }
  return (data ?? []) as Appointment[];
}

export async function getAdminAppointment(id: string): Promise<Appointment | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("appointments").select("*").eq("id", id).single();
  if (error || !data) return null;
  return data as Appointment;
}
