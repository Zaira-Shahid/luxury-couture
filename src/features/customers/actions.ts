"use server";

import { revalidatePath } from "next/cache";

import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import { addressSchema, profileUpdateSchema } from "@/lib/validations/customers";

export type ActionResult = { error: string } | { success: true };

function firstIssueMessage(error: { issues: { message: string }[] }) {
  return error.issues[0]?.message ?? "Invalid input.";
}

export async function updateProfile(formData: FormData): Promise<ActionResult> {
  const parsed = profileUpdateSchema.safeParse({
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
  });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  // RLS also enforces id = auth.uid(); the explicit filter here is
  // defense-in-depth, not the only guard.
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.fullName, phone: parsed.data.phone })
    .eq("id", user.id);

  if (error) {
    logger.error("profile update failed", error, { userId: user.id });
    return { error: "Could not update your profile. Please try again." };
  }

  revalidatePath("/account");
  return { success: true };
}

export async function createAddress(formData: FormData): Promise<ActionResult> {
  const parsed = addressSchema.safeParse({
    label: formData.get("label"),
    recipientName: formData.get("recipientName"),
    line1: formData.get("line1"),
    line2: formData.get("line2"),
    city: formData.get("city"),
    region: formData.get("region"),
    postalCode: formData.get("postalCode"),
    country: formData.get("country"),
    phone: formData.get("phone"),
    isDefault: formData.get("isDefault") === "on",
  });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { error } = await supabase.from("addresses").insert({
    customer_id: user.id,
    label: parsed.data.label,
    recipient_name: parsed.data.recipientName,
    line1: parsed.data.line1,
    line2: parsed.data.line2,
    city: parsed.data.city,
    region: parsed.data.region,
    postal_code: parsed.data.postalCode,
    country: parsed.data.country,
    phone: parsed.data.phone,
    is_default: parsed.data.isDefault,
  });

  if (error) {
    logger.error("address create failed", error, { userId: user.id });
    return { error: "Could not save the address. Please try again." };
  }

  revalidatePath("/account/addresses");
  return { success: true };
}

export async function deleteAddress(addressId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  // customer_id filter is defense-in-depth on top of RLS ownership policy.
  const { error } = await supabase
    .from("addresses")
    .delete()
    .eq("id", addressId)
    .eq("customer_id", user.id);

  if (error) {
    logger.error("address delete failed", error, { userId: user.id, addressId });
    return { error: "Could not delete the address. Please try again." };
  }

  revalidatePath("/account/addresses");
  return { success: true };
}
