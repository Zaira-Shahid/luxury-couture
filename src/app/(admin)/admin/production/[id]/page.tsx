import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getProductionOrderDetail } from "@/lib/production/get-production";

import { AdvanceStatusForm } from "./advance-status-form";
import { DetailsForm } from "./details-form";

export const metadata: Metadata = { title: "Production Order" };

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

export default async function AdminProductionOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getProductionOrderDetail(id);
  if (!detail) notFound();

  const { production, order, history } = detail;

  return (
    <div className="container flex flex-col gap-6 py-10">
      <Card>
        <CardHeader>
          <CardTitle>{order?.order_number ?? "Production Order"}</CardTitle>
          {order ? (
            <Link href={`/admin/orders/${order.id}`} className="text-sm text-muted-foreground hover:underline">
              View full order
            </Link>
          ) : null}
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            Current status: <span className="font-medium">{STATUS_LABELS[production.current_status] ?? production.current_status}</span>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Advance Status</CardTitle>
        </CardHeader>
        <CardContent>
          <AdvanceStatusForm productionOrderId={production.id} currentStatus={production.current_status} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent>
          <DetailsForm
            key={`${production.id}-${production.updated_at}`}
            productionOrderId={production.id}
            assignedTeam={production.assigned_team}
            estimatedCompletionDate={production.estimated_completion_date}
          />
        </CardContent>
      </Card>

      {history.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status History</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2 text-sm">
              {history.map((entry) => (
                <li key={entry.id} className="flex justify-between gap-4">
                  <span>
                    {STATUS_LABELS[entry.status] ?? entry.status}
                    {entry.note ? <span className="block text-xs text-muted-foreground">{entry.note}</span> : null}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatDate(entry.created_at)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
