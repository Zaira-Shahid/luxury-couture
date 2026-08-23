import type { Metadata } from "next";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { siteConfig } from "@/lib/config/site";
import { getMyReferrals } from "@/lib/referrals/get-referrals";

import { ReferralGenerateButton } from "./referral-generate-button";

export const metadata: Metadata = { title: "Referrals" };

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  completed: "Completed",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default async function ReferralsPage() {
  const referrals = await getMyReferrals();

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h1">Referrals</CardTitle>
        <CardDescription>
          Share a code with a friend — each code is single-use, so generate a new one for each person you invite.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ReferralGenerateButton />

        {referrals.length === 0 ? (
          <p className="text-sm text-muted-foreground">No referral codes yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {referrals.map((referral) => (
              <li key={referral.id} className="flex flex-col gap-1 rounded-lg border border-border p-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="font-medium">{referral.code}</span>
                  <span className="text-muted-foreground">
                    {STATUS_LABELS[referral.status] ?? referral.status}
                    {referral.status === "completed" && referral.reward_amount
                      ? ` · £${Number(referral.reward_amount).toFixed(2)} reward`
                      : ""}
                  </span>
                </div>
                {referral.status === "pending" ? (
                  <p className="text-xs break-all text-muted-foreground">
                    {siteConfig.url}/register?ref={referral.code}
                  </p>
                ) : null}
                <p className="text-xs text-muted-foreground">Created {formatDate(referral.created_at)}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
