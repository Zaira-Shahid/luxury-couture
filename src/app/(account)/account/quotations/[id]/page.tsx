import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAuthUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { Address, MeasurementProfile } from "@/types/database";

import { QuotationActions } from "./quotation-actions";

export const metadata: Metadata = { title: "Quotation" };

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

export default async function QuotationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getAuthUser();
  if (!user) notFound();

  const supabase = await createClient();
  const { data: quotation } = await supabase
    .from("quotations")
    .select("*")
    .eq("id", id)
    .eq("customer_id", user.id)
    .single();
  if (!quotation) notFound();

  const { data: enquiry } = await supabase
    .from("enquiries")
    .select("builder_configuration_id, message")
    .eq("id", quotation.enquiry_id)
    .single();

  const [{ data: addresses }, { data: measurementProfiles }] = await Promise.all([
    supabase.from("addresses").select("*").eq("customer_id", user.id).order("is_default", { ascending: false }),
    supabase.from("measurement_profiles").select("*").eq("customer_id", user.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Quotation — {formatPrice(quotation.quoted_price, quotation.currency)}</CardTitle>
          <p className="text-sm text-muted-foreground">{STATUS_LABELS[quotation.status] ?? quotation.status}</p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {enquiry?.message ? <p className="text-sm text-muted-foreground">{enquiry.message}</p> : null}
          {quotation.deposit_amount ? (
            <p className="text-sm">Deposit required: {formatPrice(quotation.deposit_amount, quotation.currency)}</p>
          ) : null}
          {quotation.notes ? <p className="text-sm">{quotation.notes}</p> : null}
          {quotation.valid_until ? (
            <p className="text-xs text-muted-foreground">
              Valid until {new Date(quotation.valid_until).toLocaleDateString()}
            </p>
          ) : null}

          {quotation.status === "sent" ? (
            <QuotationActions
              quotationId={quotation.id}
              addresses={(addresses ?? []) as Address[]}
              measurementProfiles={(measurementProfiles ?? []) as MeasurementProfile[]}
              requiresMeasurements={!!enquiry?.builder_configuration_id}
            />
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
