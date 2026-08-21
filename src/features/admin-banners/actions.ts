"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import { bannerSchema } from "@/lib/validations/marketing";

export type ActionResult = { error: string } | undefined;

function firstIssueMessage(error: { issues: { message: string }[] }) {
  return error.issues[0]?.message ?? "Invalid input.";
}

function parseFormData(formData: FormData) {
  return bannerSchema.safeParse({
    text: formData.get("text"),
    linkUrl: formData.get("linkUrl") || "",
    startsAt: formData.get("startsAt") || "",
    expiresAt: formData.get("expiresAt") || "",
    sortOrder: formData.get("sortOrder") || 0,
    isActive: formData.get("isActive") === "on",
  });
}

export async function createBanner(formData: FormData): Promise<ActionResult> {
  const parsed = parseFormData(formData);
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.from("promotional_banners").insert({
    text: parsed.data.text,
    link_url: parsed.data.linkUrl || null,
    starts_at: parsed.data.startsAt || null,
    expires_at: parsed.data.expiresAt || null,
    sort_order: parsed.data.sortOrder,
    is_active: parsed.data.isActive,
  });
  if (error) {
    logger.error("banner creation failed", error);
    return { error: "Could not create this banner." };
  }

  revalidatePath("/admin/marketing/banners");
  redirect("/admin/marketing/banners");
}

export async function updateBanner(id: string, formData: FormData): Promise<ActionResult> {
  const parsed = parseFormData(formData);
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("promotional_banners")
    .update({
      text: parsed.data.text,
      link_url: parsed.data.linkUrl || null,
      starts_at: parsed.data.startsAt || null,
      expires_at: parsed.data.expiresAt || null,
      sort_order: parsed.data.sortOrder,
      is_active: parsed.data.isActive,
    })
    .eq("id", id);
  if (error) {
    logger.error("banner update failed", error, { id });
    return { error: "Could not update this banner." };
  }

  revalidatePath("/admin/marketing/banners");
  return undefined;
}

export async function deleteBanner(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("promotional_banners").delete().eq("id", id);
  if (error) {
    logger.error("banner delete failed", error, { id });
    return { error: "Could not delete this banner." };
  }

  revalidatePath("/admin/marketing/banners");
  return undefined;
}
