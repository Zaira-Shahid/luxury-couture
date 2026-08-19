"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import {
  measurementProfileMetaSchema,
  measurementValueSchema,
} from "@/lib/validations/measurements";
import type { MeasurementFieldDefinition } from "@/types/database";

export type ActionResult = { error: string } | { success: true };

function parseFieldValues(formData: FormData, fields: MeasurementFieldDefinition[]) {
  const values: Record<string, number> = {};
  const errors: string[] = [];

  for (const field of fields) {
    const raw = formData.get(`field_${field.key}`);
    if (raw === null || raw === "") {
      if (field.is_required) errors.push(`${field.label} is required.`);
      continue;
    }
    const parsed = measurementValueSchema.safeParse(raw);
    if (!parsed.success) {
      errors.push(`${field.label}: ${parsed.error.issues[0]?.message ?? "Invalid value."}`);
      continue;
    }
    values[field.key] = parsed.data;
  }

  return { values, errors };
}

export async function saveProfile(
  profileId: string | null,
  formData: FormData
): Promise<ActionResult> {
  const meta = measurementProfileMetaSchema.safeParse({
    label: formData.get("label"),
    unit: formData.get("unit"),
    notes: formData.get("notes"),
  });
  if (!meta.success) return { error: meta.error.issues[0]?.message ?? "Invalid input." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { data: fields, error: fieldsErr } = await supabase
    .from("measurement_field_definitions")
    .select("*")
    .eq("is_active", true);
  if (fieldsErr) {
    logger.error("failed to load field definitions for save", fieldsErr);
    return { error: "Something went wrong. Please try again." };
  }

  const { values, errors } = parseFieldValues(formData, fields as MeasurementFieldDefinition[]);
  // Only hard-block on actual invalid numbers, not missing-required fields —
  // a draft can be incomplete; submitProfile is what enforces completeness.
  const invalidOnly = errors.filter((e) => !e.endsWith("is required."));
  if (invalidOnly.length > 0) return { error: invalidOnly[0] };

  let id = profileId;

  if (id) {
    // Re-check ownership explicitly, on top of RLS.
    const { data: existing } = await supabase
      .from("measurement_profiles")
      .select("customer_id, status")
      .eq("id", id)
      .single();
    if (!existing || existing.customer_id !== user.id) {
      return { error: "Profile not found." };
    }

    const resetStatus = existing.status === "submitted" || existing.status === "approved";
    const { error } = await supabase
      .from("measurement_profiles")
      .update({
        label: meta.data.label,
        unit: meta.data.unit,
        notes: meta.data.notes,
        ...(resetStatus ? { status: "draft" as const } : {}),
      })
      .eq("id", id);
    if (error) {
      logger.error("measurement profile update failed", error, { id });
      return { error: "Could not save. Please try again." };
    }
  } else {
    const { data: created, error } = await supabase
      .from("measurement_profiles")
      .insert({
        customer_id: user.id,
        label: meta.data.label,
        unit: meta.data.unit,
        notes: meta.data.notes,
      })
      .select("id")
      .single();
    if (error || !created) {
      logger.error("measurement profile create failed", error);
      return { error: "Could not save. Please try again." };
    }
    id = created.id;
  }

  const rows = Object.entries(values).map(([field_key, value]) => ({
    measurement_profile_id: id,
    field_key,
    value,
  }));

  if (rows.length > 0) {
    const { error } = await supabase
      .from("measurements")
      .upsert(rows, { onConflict: "measurement_profile_id,field_key" });
    if (error) {
      logger.error("measurement values save failed", error, { id });
      return { error: "Could not save your measurements. Please try again." };
    }
  }

  revalidatePath("/account/measurements");
  revalidatePath(`/account/measurements/${id}/edit`);
  if (!profileId) redirect(`/account/measurements/${id}/edit`);
  return { success: true };
}

export async function submitProfile(profileId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const [{ data: fields }, { data: existingValues }] = await Promise.all([
    supabase.from("measurement_field_definitions").select("key, label").eq("is_active", true).eq("is_required", true),
    supabase.from("measurements").select("field_key").eq("measurement_profile_id", profileId),
  ]);

  const filled = new Set((existingValues ?? []).map((v) => v.field_key));
  const missing = (fields ?? []).filter((f) => !filled.has(f.key));
  if (missing.length > 0) {
    return { error: `Please fill in: ${missing.map((f) => f.label).join(", ")}.` };
  }

  const { error } = await supabase
    .from("measurement_profiles")
    .update({ status: "submitted" })
    .eq("id", profileId)
    .eq("customer_id", user.id);

  if (error) {
    logger.error("measurement profile submit failed", error, { profileId });
    return { error: "Could not submit. Please try again." };
  }

  revalidatePath("/account/measurements");
  revalidatePath(`/account/measurements/${profileId}/edit`);
  return { success: true };
}

export async function deleteProfile(profileId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { error } = await supabase
    .from("measurement_profiles")
    .delete()
    .eq("id", profileId)
    .eq("customer_id", user.id);

  if (error) {
    logger.error("measurement profile delete failed", error, { profileId });
    return { error: "Could not delete. Please try again." };
  }

  revalidatePath("/account/measurements");
  return { success: true };
}
