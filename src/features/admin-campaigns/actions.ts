"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { getCampaignRecipients } from "@/lib/admin/get-campaign-recipients";
import { logger } from "@/lib/logger";
import { campaignEmail } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/send";
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
 * Sends through the MARKETING email path, not notify(). Two reasons:
 * a campaign is deliberately kept out of the transactional in-app
 * notification feed (order/payment/shipping updates), and — as of
 * Module 24 — a marketing email requires an unsubscribe URL that
 * notify() has no way to supply. The marketing template takes that URL
 * as a required argument, so a campaign cannot be sent without one.
 */
export async function sendCampaign(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: campaign } = await supabase.from("campaigns").select("*").eq("id", id).single();
  if (!campaign) return { error: "Campaign not found." };
  if (campaign.status === "sent") return { error: "This campaign has already been sent." };

  const recipients = await getCampaignRecipients(campaign.target);
  // Recipients are already filtered for opt-outs on every target (0051),
  // and each carries its own unsubscribe token.
  let sent = 0;
  for (const recipient of recipients) {
    const message = await campaignEmail(
      recipient.email,
      campaign.subject,
      campaign.body,
      recipient.unsubscribeUrl
    );
    const result = await sendEmail(message);
    if (result.ok) sent += 1;
  }

  const { error } = await supabase
    .from("campaigns")
    .update({ status: "sent", sent_at: new Date().toISOString(), recipient_count: sent })
    .eq("id", id);
  if (error) {
    logger.error("campaign send status update failed", error, { id });
    return { error: "Emails were sent, but the campaign record could not be updated." };
  }

  revalidatePath(`/admin/marketing/campaigns/${id}`);
  revalidatePath("/admin/marketing/campaigns");
  return undefined;
}
