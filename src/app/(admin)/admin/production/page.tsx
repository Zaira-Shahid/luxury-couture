import type { Metadata } from "next";
import Link from "next/link";

import { getAdminProductionOrders } from "@/lib/production/get-production";

export const metadata: Metadata = { title: "Production" };

const STATUS_LABELS: Record<string, string> = {
  order_confirmed: "Order Confirmed",
  measurements_verified: "Measurements Verified",
  design_approved: "Design Approved",
  materials_prepared: "Materials Prepared",
  cutting: "Cutting",
  embroidery: "Embroidery",
  stitching: "Stitching",
  finishing: "Finishing",
  quality_check: "Quality Check",
  ready_for_dispatch: "Ready for Dispatch",
  shipped: "Shipped",
  delivered: "Delivered",
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default async function AdminProductionPage() {
  const productionOrders = await getAdminProductionOrders();

  return (
    <div className="container py-10">
      <h1 className="mb-6 font-heading text-2xl">Production</h1>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-2">Order</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Assigned team</th>
              <th className="px-4 py-2">Estimated completion</th>
            </tr>
          </thead>
          <tbody>
            {productionOrders.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                  No production orders yet.
                </td>
              </tr>
            ) : (
              productionOrders.map((po) => (
                <tr key={po.id} className="border-t border-border">
                  <td className="px-4 py-2">
                    <Link href={`/admin/production/${po.id}`} className="hover:underline">
                      {po.orders?.order_number ?? "—"}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{STATUS_LABELS[po.current_status] ?? po.current_status}</td>
                  <td className="px-4 py-2 text-muted-foreground">{po.assigned_team ?? "—"}</td>
                  <td className="px-4 py-2 text-muted-foreground">{formatDate(po.estimated_completion_date)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
