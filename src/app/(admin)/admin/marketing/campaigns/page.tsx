import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getAdminCampaigns } from "@/lib/admin/get-campaigns";

export const metadata: Metadata = { title: "Campaigns" };

const TARGET_LABELS: Record<string, string> = {
  all_subscribers: "All newsletter subscribers",
  vip_customers: "VIP customers",
  new_customers: "New customers",
  at_risk_customers: "At-risk customers",
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default async function AdminCampaignsPage() {
  const campaigns = await getAdminCampaigns();

  return (
    <div className="container py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-heading text-2xl">Campaigns</h1>
        <Button render={<Link href="/admin/marketing/campaigns/new" />}>New Campaign</Button>
      </div>

      {campaigns.length === 0 ? (
        <p className="text-sm text-muted-foreground">No campaigns yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Subject</th>
                <th className="px-4 py-2 font-medium">Target</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Sent</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign) => (
                <tr key={campaign.id} className="border-t border-border">
                  <td className="px-4 py-2">
                    <Link href={`/admin/marketing/campaigns/${campaign.id}`} className="hover:underline">
                      {campaign.subject}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{TARGET_LABELS[campaign.target] ?? campaign.target}</td>
                  <td className="px-4 py-2">{campaign.status === "sent" ? "Sent" : "Draft"}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {formatDate(campaign.sent_at)}
                    {campaign.recipient_count !== null ? ` · ${campaign.recipient_count} recipients` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
