import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isStripeConfigured } from "@/lib/payments";
import { getOrderDetail } from "@/lib/orders/get-orders";

import { PayNowButton } from "./pay-now-button";

export const metadata: Metadata = { title: "Order" };

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  in_production: "In Production",
  ready_to_ship: "Ready to Ship",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const PRODUCTION_STATUS_LABELS: Record<string, string> = {
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

const SHIPPING_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  label_created: "Label Created",
  in_transit: "In Transit",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  exception: "Exception",
};

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  deposit: "Deposit",
  balance: "Balance",
  full: "Payment",
  refund: "Refund",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  succeeded: "Paid",
  failed: "Failed",
  refunded: "Refunded",
};

function formatPrice(amount: number, currency: string) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getOrderDetail(id);
  if (!detail) notFound();

  const { order, items, payments, statusHistory, production, productionHistory, shipping, address } = detail;
  const pendingPayments = payments.filter((p) => p.status === "pending");

  const timeline = [
    ...statusHistory.map((entry) => ({
      id: entry.id,
      label: ORDER_STATUS_LABELS[entry.status] ?? entry.status,
      note: entry.note,
      createdAt: entry.created_at,
    })),
    ...productionHistory.map((entry) => ({
      id: entry.id,
      label: PRODUCTION_STATUS_LABELS[entry.status] ?? entry.status,
      note: entry.note,
      createdAt: entry.created_at,
    })),
  ].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{order.order_number}</CardTitle>
          <p className="text-sm text-muted-foreground">
            Placed {formatDate(order.created_at)} · {ORDER_STATUS_LABELS[order.status] ?? order.status}
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ul className="flex flex-col gap-2 text-sm">
            {items.map((item) => (
              <li key={item.id} className="flex justify-between gap-4">
                <span>
                  {item.description_snapshot} × {item.quantity}
                </span>
                <span>{formatPrice(item.line_total, order.currency)}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-1 border-t border-border pt-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total</span>
              <span className="font-medium">{formatPrice(order.total_amount, order.currency)}</span>
            </div>
            {order.balance_due_amount > 0 ? (
              <div className="flex justify-between text-muted-foreground">
                <span>Balance due</span>
                <span>{formatPrice(order.balance_due_amount, order.currency)}</span>
              </div>
            ) : null}
          </div>
          {order.notes ? <p className="text-xs text-muted-foreground">Note: {order.notes}</p> : null}
          {address ? (
            <p className="text-xs text-muted-foreground">
              Shipping to: {address.recipient_name}, {address.line1}, {address.city} {address.postal_code},{" "}
              {address.country}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {timeline.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Order Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-3 text-sm">
              {timeline.map((entry) => (
                <li key={entry.id} className="flex justify-between gap-4">
                  <span>
                    {entry.label}
                    {entry.note ? <span className="block text-xs text-muted-foreground">{entry.note}</span> : null}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatDate(entry.createdAt)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {production || shipping ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Production &amp; Shipping</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {production ? (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Production status</span>
                <span>
                  {PRODUCTION_STATUS_LABELS[production.current_status] ?? production.current_status}
                  {production.estimated_completion_date
                    ? ` (est. ${formatDate(production.estimated_completion_date)})`
                    : ""}
                </span>
              </div>
            ) : null}
            {shipping ? (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipping status</span>
                <span>
                  {SHIPPING_STATUS_LABELS[shipping.status] ?? shipping.status}
                  {shipping.tracking_number ? ` · ${shipping.tracking_number}` : ""}
                </span>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payments</CardTitle>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
          ) : (
            <ul className="flex flex-col gap-3 text-sm">
              {payments.map((payment) => (
                <li key={payment.id} className="flex items-center justify-between gap-4">
                  <span>
                    {PAYMENT_TYPE_LABELS[payment.type] ?? payment.type} —{" "}
                    {formatPrice(payment.amount, payment.currency)}
                  </span>
                  {payment.status === "pending" && isStripeConfigured() ? (
                    <PayNowButton paymentId={payment.id} />
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {PAYMENT_STATUS_LABELS[payment.status] ?? payment.status}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {pendingPayments.length > 0 && !isStripeConfigured() ? (
            <p className="mt-3 text-xs text-muted-foreground">We&apos;ll contact you to arrange payment.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
