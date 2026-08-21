import type { Metadata } from "next";
import Link from "next/link";

import { getAdminQuotations } from "@/lib/admin/get-quotations";

export const metadata: Metadata = { title: "Quotations" };

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Awaiting customer approval",
  accepted: "Accepted",
  rejected: "Declined",
  expired: "Expired",
};

function formatPrice(amount: number, currency: string) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
}

export default async function AdminQuotationsPage() {
  const quotations = await getAdminQuotations();

  return (
    <div className="container py-10">
      <h1 className="mb-6 font-heading text-2xl">Quotations</h1>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-2">Customer</th>
              <th className="px-4 py-2">Price</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Valid until</th>
              <th className="px-4 py-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {quotations.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  No quotations yet.
                </td>
              </tr>
            ) : (
              quotations.map((quotation) => (
                <tr key={quotation.id} className="border-t border-border">
                  <td className="px-4 py-2">
                    <Link href={`/admin/enquiries/${quotation.enquiry_id}`} className="hover:underline">
                      {quotation.enquiries?.contact_name ?? "Unknown"}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{formatPrice(quotation.quoted_price, quotation.currency)}</td>
                  <td className="px-4 py-2">{STATUS_LABELS[quotation.status] ?? quotation.status}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {quotation.valid_until ? new Date(quotation.valid_until).toLocaleDateString("en-GB") : "—"}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {new Date(quotation.created_at).toLocaleDateString("en-GB")}
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
