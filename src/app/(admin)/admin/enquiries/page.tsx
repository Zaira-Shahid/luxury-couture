import type { Metadata } from "next";
import Link from "next/link";

import { getAdminEnquiries } from "@/lib/enquiries/get-enquiries";
import type { EnquiryStatus } from "@/types/database";

export const metadata: Metadata = { title: "Enquiries" };

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  in_review: "In review",
  quoted: "Quoted",
  closed: "Closed",
};

const STATUSES: EnquiryStatus[] = ["new", "in_review", "quoted", "closed"];

const TYPE_LABELS: Record<string, string> = {
  general: "General",
  consultation: "Consultation",
  builder: "Custom Builder",
};

export default async function AdminEnquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const activeStatus =
    status && STATUSES.includes(status as EnquiryStatus) ? (status as EnquiryStatus) : undefined;
  const enquiries = await getAdminEnquiries(activeStatus);

  return (
    <div className="container py-10">
      <h1 className="font-heading text-2xl">Enquiries</h1>

      <div className="mt-4 flex gap-2 text-sm">
        <Link
          href="/admin/enquiries"
          className={!activeStatus ? "font-medium text-foreground" : "text-muted-foreground"}
        >
          All
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/enquiries?status=${s}`}
            className={activeStatus === s ? "font-medium text-foreground" : "text-muted-foreground"}
          >
            {STATUS_LABELS[s]}
          </Link>
        ))}
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-2">Contact</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Received</th>
            </tr>
          </thead>
          <tbody>
            {enquiries.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                  No enquiries found.
                </td>
              </tr>
            ) : (
              enquiries.map((enquiry) => (
                <tr key={enquiry.id} className="border-t border-border">
                  <td className="px-4 py-2">
                    <Link
                      href={`/admin/enquiries/${enquiry.id}`}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {enquiry.contact_name}
                    </Link>
                    <p className="text-xs text-muted-foreground">{enquiry.contact_email}</p>
                  </td>
                  <td className="px-4 py-2">{TYPE_LABELS[enquiry.type] ?? enquiry.type}</td>
                  <td className="px-4 py-2">{STATUS_LABELS[enquiry.status] ?? enquiry.status}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {new Date(enquiry.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
