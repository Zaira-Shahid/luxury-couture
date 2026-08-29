"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createBannerRecord, updateBannerRecord } from "@/lib/content/write-content";
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
  // isActive is passed because this form has always had the checkbox.
  // No MCP tool passes it — see BannerInput.isActive.
  const result = await createBannerRecord(
    {
      text: parsed.data.text,
      linkUrl: parsed.data.linkUrl || null,
      startsAt: parsed.data.startsAt || null,
      expiresAt: parsed.data.expiresAt || null,
      sortOrder: parsed.data.sortOrder,
      isActive: parsed.data.isActive,
    },
    supabase
  );
  if (!result.ok) return { error: result.error };

  revalidatePath("/admin/marketing/banners");
  // redirect() THROWS, which is why it stays in the action: a browser has
  // a Next render to catch it and the MCP route does not.
  redirect("/admin/marketing/banners");
}

export async function updateBanner(id: string, formData: FormData): Promise<ActionResult> {
  const parsed = parseFormData(formData);
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const supabase = await createClient();
  // The form posts every field, so passing them all preserves its
  // "blank means clear" behaviour exactly. A tool omitting a field means
  // something different, which the service distinguishes.
  const result = await updateBannerRecord(
    id,
    {
      text: parsed.data.text,
      linkUrl: parsed.data.linkUrl || null,
      startsAt: parsed.data.startsAt || null,
      expiresAt: parsed.data.expiresAt || null,
      sortOrder: parsed.data.sortOrder,
      isActive: parsed.data.isActive,
    },
    supabase
  );
  if (!result.ok) return { error: result.error };

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
