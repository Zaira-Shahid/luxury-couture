import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getShippingOrderDetail } from "@/lib/shipping/get-shipping";

import { AdvanceStatusForm } from "./advance-status-form";
import { DetailsForm } from "./details-form";

export const metadata: Metadata = { title: "Shipment" };

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  label_created: "Label Created",
  in_transit: "In Transit",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  exception: "Exception",
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default async function AdminShippingOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getShippingOrderDetail(id);
  if (!detail) notFound();

  const { shipping, order, events } = detail;

  return (
    <div className="container flex flex-col gap-6 py-10">
      <Card>
        <CardHeader>
          <CardTitle>{order?.order_number ?? "Shipment"}</CardTitle>
          {order ? (
            <Link href={`/admin/orders/${order.id}`} className="text-sm text-muted-foreground hover:underline">
              View full order
            </Link>
          ) : null}
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            Current status: <span className="font-medium">{STATUS_LABELS[shipping.status] ?? shipping.status}</span>
          </p>
          {shipping.shipped_at ? <p className="text-xs text-muted-foreground">Shipped {formatDate(shipping.shipped_at)}</p> : null}
          {shipping.delivered_at ? <p className="text-xs text-muted-foreground">Delivered {formatDate(shipping.delivered_at)}</p> : null}
          {shipping.shipping_cost !== null ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Estimated cost (internal, not charged to customer): £{Number(shipping.shipping_cost).toFixed(2)}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Advance Status</CardTitle>
        </CardHeader>
        <CardContent>
          <AdvanceStatusForm shippingOrderId={shipping.id} currentStatus={shipping.status} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent>
          <DetailsForm
            key={`${shipping.id}-${shipping.updated_at}`}
            shippingOrderId={shipping.id}
            courier={shipping.courier}
            trackingNumber={shipping.tracking_number}
          />
        </CardContent>
      </Card>

      {events.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tracking Events</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2 text-sm">
              {events.map((entry) => (
                <li key={entry.id} className="flex justify-between gap-4">
                  <span>
                    {STATUS_LABELS[entry.status] ?? entry.status}
                    {entry.description ? (
                      <span className="block text-xs text-muted-foreground">{entry.description}</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatDate(entry.occurred_at)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
