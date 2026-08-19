import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { MeasurementProfile, MeasurementProfileStatus } from "@/types/database";

export type AdminMeasurementProfile = MeasurementProfile & {
  profiles: { full_name: string | null } | null;
};

/** Admin-only: every measurement profile, optionally filtered by status. */
export async function getAdminMeasurementProfiles(
  status?: MeasurementProfileStatus
): Promise<AdminMeasurementProfile[]> {
  const supabase = await createClient();
  let query = supabase
    .from("measurement_profiles")
    .select("*, profiles(full_name)")
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) {
    logger.warn("failed to load admin measurement profiles", { message: error.message });
    return [];
  }
  return (data ?? []) as unknown as AdminMeasurementProfile[];
}
