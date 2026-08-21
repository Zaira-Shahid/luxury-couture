import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DeleteButton } from "@/components/admin/delete-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { deleteCampaign } from "@/features/admin-campaigns/actions";
import { getCampaignRecipients } from "@/lib/admin/get-campaign-recipients";
import { getAdminCampaign } from "@/lib/admin/get-campaigns";

import { SendCampaignButton } from "./send-campaign-button";

export const metadata: Metadata = { title: "Campaign" };

const TARGET_LABELS: Record<string, string> = {
  all_subscribers: "All newsletter subscribers",
  vip_customers: "VIP customers",
  new_customers: "New customers",
  at_risk_customers: "At-risk customers",
};

export default async function AdminCampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campaign = await getAdminCampaign(id);
  if (!campaign) notFound();

  const recipients = campaign.status === "draft" ? await getCampaignRecipients(campaign.target) : [];

  return (
    <div className="container flex max-w-2xl flex-col gap-6 py-10">
      <Card>
        <CardHeader>
          <CardTitle>{campaign.subject}</CardTitle>
          <p className="text-sm text-muted-foreground">{TARGET_LABELS[campaign.target] ?? campaign.target}</p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm whitespace-pre-wrap">{campaign.body}</p>

          {campaign.status === "sent" ? (
            <p className="text-sm text-primary">
              Sent to {campaign.recipient_count} recipient{campaign.recipient_count === 1 ? "" : "s"} on{" "}
              {campaign.sent_at ? new Date(campaign.sent_at).toLocaleString("en-GB") : ""}.
            </p>
          ) : (
            <div className="flex items-center gap-3">
              <p className="text-sm text-muted-foreground">
                Will send to {recipients.length} recipient{recipients.length === 1 ? "" : "s"}.
              </p>
              <SendCampaignButton campaignId={campaign.id} />
              <DeleteButton action={deleteCampaign.bind(null, campaign.id)} confirmMessage="Delete this draft?" />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
