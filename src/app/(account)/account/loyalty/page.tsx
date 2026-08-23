import type { Metadata } from "next";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getMyLoyaltyAccount } from "@/lib/loyalty/get-loyalty";
import { pointsToPounds } from "@/lib/loyalty/config";

export const metadata: Metadata = { title: "Loyalty" };

const TYPE_LABELS: Record<string, string> = {
  earn: "Earned",
  redeem: "Redeemed",
  adjust: "Adjustment",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default async function LoyaltyPage() {
  const { account, transactions } = await getMyLoyaltyAccount();
  const balance = account?.points_balance ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle as="h1">Loyalty Points</CardTitle>
          <CardDescription>Earn 1 point for every £1 spent — 100 points = £1 off at checkout.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="font-heading text-3xl">{balance} points</p>
          <p className="text-sm text-muted-foreground">Worth up to {pointsToPounds(balance).toFixed(2)} in discounts.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">History</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {transactions.map((tx) => (
                <li key={tx.id} className="flex items-center justify-between gap-4">
                  <span>{TYPE_LABELS[tx.type] ?? tx.type}</span>
                  <span className={tx.points >= 0 ? "text-primary" : "text-muted-foreground"}>
                    {tx.points >= 0 ? "+" : ""}
                    {tx.points}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatDate(tx.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
