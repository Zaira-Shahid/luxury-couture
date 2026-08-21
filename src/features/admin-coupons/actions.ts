"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import { couponSchema } from "@/lib/validations/marketing";

export type ActionResult = { error: string } | undefined;

function firstIssueMessage(error: { issues: { message: string }[] }) {
  return error.issues[0]?.message ?? "Invalid input.";
}

function parseFormData(formData: FormData) {
  return couponSchema.safeParse({
    code: formData.get("code"),
    type: formData.get("type"),
    value: formData.get("value"),
    minOrderAmount: formData.get("minOrderAmount") || "",
    maxUses: formData.get("maxUses") || "",
    startsAt: formData.get("startsAt") || "",
    expiresAt: formData.get("expiresAt") || "",
    isActive: formData.get("isActive") === "on",
  });
}

export async function createCoupon(formData: FormData): Promise<ActionResult> {
  const parsed = parseFormData(formData);
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.from("coupons").insert({
    code: parsed.data.code,
    type: parsed.data.type,
    value: parsed.data.value,
    min_order_amount: parsed.data.minOrderAmount || null,
    max_uses: parsed.data.maxUses || null,
    starts_at: parsed.data.startsAt || null,
    expires_at: parsed.data.expiresAt || null,
    is_active: parsed.data.isActive,
  });
  if (error) {
    logger.error("coupon creation failed", error);
    return { error: error.code === "23505" ? "That code is already in use." : "Could not create this coupon." };
  }

  revalidatePath("/admin/marketing");
  redirect("/admin/marketing");
}

export async function updateCoupon(id: string, formData: FormData): Promise<ActionResult> {
  const parsed = parseFormData(formData);
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("coupons")
    .update({
      code: parsed.data.code,
      type: parsed.data.type,
      value: parsed.data.value,
      min_order_amount: parsed.data.minOrderAmount || null,
      max_uses: parsed.data.maxUses || null,
      starts_at: parsed.data.startsAt || null,
      expires_at: parsed.data.expiresAt || null,
      is_active: parsed.data.isActive,
    })
    .eq("id", id);
  if (error) {
    logger.error("coupon update failed", error, { id });
    return { error: error.code === "23505" ? "That code is already in use." : "Could not update this coupon." };
  }

  revalidatePath("/admin/marketing");
  return undefined;
}

export async function deleteCoupon(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("coupons").delete().eq("id", id);
  if (error) {
    logger.error("coupon delete failed", error, { id });
    return { error: "Could not delete this coupon." };
  }

  revalidatePath("/admin/marketing");
  return undefined;
}
