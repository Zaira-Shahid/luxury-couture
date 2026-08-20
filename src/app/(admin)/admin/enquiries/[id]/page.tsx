import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAuthUser } from "@/lib/auth/session";
import { getAdminEnquiry } from "@/lib/enquiries/get-enquiries";
import { createClient } from "@/lib/supabase/server";
import type { Quotation } from "@/types/database";

import { CreateQuotationForm } from "./create-quotation-form";
import { EnquiryActions } from "./enquiry-actions";

export const metadata: Metadata = { title: "Enquiry" };

const TYPE_LABELS: Record<string, string> = {
  general: "General",
  consultation: "Consultation",
  builder: "Custom Builder",
};

const QUOTATION_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Awaiting customer approval",
  accepted: "Accepted",
  rejected: "Declined",
  expired: "Expired",
};

function formatPrice(amount: number, currency: string) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
}

export default async function AdminEnquiryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [enquiry, user] = await Promise.all([getAdminEnquiry(id), getAuthUser()]);
  if (!enquiry) notFound();

  const supabase = await createClient();
  const { data: quotations } = await supabase
    .from("quotations")
    .select("*")
    .eq("enquiry_id", id)
    .order("created_at", { ascending: false });

  const hasOpenQuotation = (quotations ?? []).some((q) => q.status === "sent" || q.status === "accepted");

  return (
    <div className="container flex flex-col gap-6 py-10">
      <Card>
        <CardHeader>
          <CardTitle>{enquiry.contact_name}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {enquiry.contact_email}
            {enquiry.contact_phone ? ` · ${enquiry.contact_phone}` : ""} ·{" "}
            {TYPE_LABELS[enquiry.type] ?? enquiry.type}
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {enquiry.message ? <p className="text-sm">{enquiry.message}</p> : null}
          {enquiry.builder_configuration_id ? (
            <p className="text-xs text-muted-foreground">
              Linked custom design: {enquiry.builder_configuration_id}
            </p>
          ) : null}
          <EnquiryActions
            enquiryId={enquiry.id}
            currentStatus={enquiry.status}
            isAssignedToMe={enquiry.assigned_admin_id === user?.id}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quotations</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {(quotations as Quotation[] | null)?.length ? (
            <ul className="flex flex-col gap-2">
              {(quotations as Quotation[]).map((quotation) => (
                <li key={quotation.id} className="flex justify-between text-sm">
                  <span>{formatPrice(quotation.quoted_price, quotation.currency)}</span>
                  <span className="text-muted-foreground">
                    {QUOTATION_STATUS_LABELS[quotation.status] ?? quotation.status}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No quotations sent yet.</p>
          )}
          {!hasOpenQuotation ? <CreateQuotationForm enquiryId={id} /> : null}
        </CardContent>
      </Card>
    </div>
  );
}
