import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAuthUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { Quotation } from "@/types/database";

export const metadata: Metadata = { title: "Quotations" };

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Awaiting your approval",
  accepted: "Accepted",
  rejected: "Declined",
  expired: "Expired",
};

function formatPrice(amount: number, currency: string) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
}

export default async function QuotationsPage() {
  const user = await getAuthUser();
  const supabase = await createClient();
  const { data: quotations } = user
    ? await supabase
        .from("quotations")
        .select("*")
        .eq("customer_id", user.id)
        .neq("status", "draft")
        .order("created_at", { ascending: false })
    : { data: [] };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quotations</CardTitle>
        <CardDescription>Custom quotes from our design team, ready for your approval.</CardDescription>
      </CardHeader>
      <CardContent>
        {!quotations || quotations.length === 0 ? (
          <p className="text-sm text-muted-foreground">No quotations yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {(quotations as Quotation[]).map((quotation) => (
              <li key={quotation.id}>
                <Link
                  href={`/account/quotations/${quotation.id}`}
                  className="flex items-center justify-between gap-4 rounded-lg border border-border p-3 text-sm hover:border-foreground/30"
                >
                  <span>{formatPrice(quotation.quoted_price, quotation.currency)}</span>
                  <span className="text-muted-foreground">
                    {STATUS_LABELS[quotation.status] ?? quotation.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
