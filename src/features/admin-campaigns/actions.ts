"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { getCampaignRecipients } from "@/lib/admin/get-campaign-recipients";
import { logger } from "@/lib/logger";
import { sendMockEmail } from "@/lib/notifications/mock-channels";
import { createClient } from "@/lib/supabase/server";
import { campaignSchema } from "@/lib/validations/marketing";

export type ActionResult = { error: string } | undefined;

function firstIssueMessage(error: { issues: { message: string }[] }) {
  return error.issues[0]?.message ?? "Invalid input.";
}

export async function createCampaign(formData: FormData): Promise<ActionResult> {
  const parsed = campaignSchema.safeParse({
    subject: formData.get("subject"),
    body: formData.get("body"),
    target: formData.get("target"),
  });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaigns")
    .insert({ subject: parsed.data.subject, body: parsed.data.body, target: parsed.data.target, status: "draft" })
    .select("id")
    .single();
  if (error || !data) {
    logger.error("campaign creation failed", error);
    return { error: "Could not create this campaign. Please try again." };
  }

  revalidatePath("/admin/marketing/campaigns");
  redirect(`/admin/marketing/campaigns/${data.id}`);
}

export async function deleteCampaign(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("campaigns").delete().eq("id", id).eq("status", "draft");
  if (error) {
    logger.error("campaign delete failed", error, { id });
    return { error: "Could not delete this campaign." };
  }

  revalidatePath("/admin/marketing/campaigns");
  return undefined;
}

/**
 * Sends via the mock email channel directly, not notify() — a marketing
 * campaign is deliberately kept out of the transactional in-app
 * notification feed (order/payment/shipping updates), a separate concern
 * even though both ultimately log through the same mock provider.
 */
export async function sendCampaign(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: campaign } = await supabase.from("campaigns").select("*").eq("id", id).single();
  if (!campaign) return { error: "Campaign not found." };
  if (campaign.status === "sent") return { error: "This campaign has already been sent." };

  const recipients = await getCampaignRecipients(campaign.target);
  for (const recipient of recipients) {
    sendMockEmail(recipient.email, campaign.subject, campaign.body);
  }

  const { error } = await supabase
    .from("campaigns")
    .update({ status: "sent", sent_at: new Date().toISOString(), recipient_count: recipients.length })
    .eq("id", id);
  if (error) {
    logger.error("campaign send status update failed", error, { id });
    return { error: "Emails were sent, but the campaign record could not be updated." };
  }

  revalidatePath(`/admin/marketing/campaigns/${id}`);
  revalidatePath("/admin/marketing/campaigns");
  return undefined;
}
