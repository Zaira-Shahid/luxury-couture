import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAuthUser } from "@/lib/auth/session";
import { getAdminEnquiry } from "@/lib/enquiries/get-enquiries";

import { EnquiryActions } from "./enquiry-actions";

export const metadata: Metadata = { title: "Enquiry" };

const TYPE_LABELS: Record<string, string> = {
  general: "General",
  consultation: "Consultation",
  builder: "Custom Builder",
};

export default async function AdminEnquiryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [enquiry, user] = await Promise.all([getAdminEnquiry(id), getAuthUser()]);
  if (!enquiry) notFound();

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
    </div>
  );
}
