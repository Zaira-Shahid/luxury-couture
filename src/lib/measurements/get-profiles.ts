import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { Measurement, MeasurementProfile } from "@/types/database";

/** The signed-in customer's own measurement profiles. */
export async function getMeasurementProfiles(): Promise<MeasurementProfile[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("measurement_profiles")
    .select("*")
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    logger.warn("failed to load measurement profiles", { message: error.message });
    return [];
  }
  return (data ?? []) as MeasurementProfile[];
}

/**
 * A single profile + its field values, by id. Works for both the owning
 * customer and an admin — RLS (owner-or-admin) gates it, not this query.
 */
export async function getMeasurementProfile(
  id: string
): Promise<{ profile: MeasurementProfile; values: Record<string, number> } | null> {
  const supabase = await createClient();
  const [profileResult, measurementsResult] = await Promise.all([
    supabase.from("measurement_profiles").select("*").eq("id", id).single(),
    supabase.from("measurements").select("field_key, value").eq("measurement_profile_id", id),
  ]);

  if (profileResult.error || !profileResult.data) return null;

  const values: Record<string, number> = {};
  for (const row of (measurementsResult.data ?? []) as Pick<Measurement, "field_key" | "value">[]) {
    values[row.field_key] = Number(row.value);
  }

  return { profile: profileResult.data as MeasurementProfile, values };
}
