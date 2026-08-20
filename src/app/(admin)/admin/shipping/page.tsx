import type { Metadata } from "next";
import Link from "next/link";

import { getAdminShippingOrders } from "@/lib/shipping/get-shipping";

export const metadata: Metadata = { title: "Shipping" };

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  label_created: "Label Created",
  in_transit: "In Transit",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  exception: "Exception",
};

export default async function AdminShippingPage() {
  const shipments = await getAdminShippingOrders();

  return (
    <div className="container py-10">
      <h1 className="mb-6 font-heading text-2xl">Shipping</h1>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-2">Order</th>
              <th className="px-4 py-2">Courier</th>
              <th className="px-4 py-2">Tracking number</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {shipments.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                  No shipments yet.
                </td>
              </tr>
            ) : (
              shipments.map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="px-4 py-2">
                    <Link href={`/admin/shipping/${s.id}`} className="hover:underline">
                      {s.orders?.order_number ?? "—"}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{s.courier ?? "—"}</td>
                  <td className="px-4 py-2 text-muted-foreground">{s.tracking_number ?? "—"}</td>
                  <td className="px-4 py-2">{STATUS_LABELS[s.status] ?? s.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
