import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminOrderDetail } from "@/lib/orders/get-orders";

import { PaymentRowActions } from "../../payments/payment-row-actions";
import { CreateShipmentButton } from "./create-shipment-button";
import { OrderNotes } from "./order-notes";
import { OrderStatusForm } from "./order-status-form";
import { SendMessageForm } from "./send-message-form";
import { SendToProductionForm } from "./send-to-production-form";

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

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  deposit: "Deposit",
  balance: "Balance",
  full: "Full",
  refund: "Refund",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  succeeded: "Succeeded",
  failed: "Failed",
  refunded: "Refunded",
};

function formatPrice(amount: number, currency: string) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getAdminOrderDetail(id);
  if (!detail) notFound();

  const { order, items, payments, statusHistory, production, shipping, address, customer, notes } = detail;

  return (
    <div className="container flex flex-col gap-6 py-10">
      <Card>
        <CardHeader>
          <CardTitle>{order.order_number}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {customer?.full_name ?? "Unknown customer"} · Placed {formatDate(order.created_at)} ·{" "}
            {ORDER_STATUS_LABELS[order.status] ?? order.status}
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
          <div className="flex justify-between border-t border-border pt-3 text-sm font-medium">
            <span>Total</span>
            <span>{formatPrice(order.total_amount, order.currency)}</span>
          </div>
          {order.notes ? (
            <p className="text-xs text-muted-foreground">Customer note: {order.notes}</p>
          ) : null}
          {address ? (
            <p className="text-xs text-muted-foreground">
              Shipping to: {address.recipient_name}, {address.line1}, {address.city} {address.postal_code},{" "}
              {address.country}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status</CardTitle>
        </CardHeader>
        <CardContent>
          <OrderStatusForm orderId={order.id} currentStatus={order.status} />
        </CardContent>
      </Card>

      {statusHistory.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2 text-sm">
              {statusHistory.map((entry) => (
                <li key={entry.id} className="flex justify-between gap-4">
                  <span>
                    {ORDER_STATUS_LABELS[entry.status] ?? entry.status}
                    {entry.note ? <span className="block text-xs text-muted-foreground">{entry.note}</span> : null}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatDate(entry.created_at)}</span>
                </li>
              ))}
            </ul>
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
                    {formatPrice(payment.amount, payment.currency)} ·{" "}
                    {PAYMENT_STATUS_LABELS[payment.status] ?? payment.status}
                  </span>
                  <PaymentRowActions paymentId={payment.id} status={payment.status} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {!production ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Production</CardTitle>
          </CardHeader>
          <CardContent>
            <SendToProductionForm orderId={order.id} />
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
                  {production.current_status}
                  {production.estimated_completion_date
                    ? ` (est. ${formatDate(production.estimated_completion_date)})`
                    : ""}
                </span>
              </div>
            ) : null}
            {shipping ? (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipping status</span>
                <Link href={`/admin/shipping/${shipping.id}`} className="hover:underline">
                  {shipping.status}
                  {shipping.tracking_number ? ` · ${shipping.tracking_number}` : ""}
                </Link>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {!shipping ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Shipping</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateShipmentButton orderId={order.id} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Message Customer</CardTitle>
        </CardHeader>
        <CardContent>
          <SendMessageForm orderId={order.id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Internal Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <OrderNotes orderId={order.id} notes={notes} />
        </CardContent>
      </Card>
    </div>
  );
}
