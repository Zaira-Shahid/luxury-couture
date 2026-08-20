import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getMyOrders } from "@/lib/orders/get-orders";

export const metadata: Metadata = { title: "Orders" };

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  in_production: "In Production",
  ready_to_ship: "Ready to Ship",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

function formatPrice(amount: number, currency: string) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
}

export default async function OrdersPage() {
  const orders = await getMyOrders();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Orders</CardTitle>
        <CardDescription>Track your custom orders here.</CardDescription>
      </CardHeader>
      <CardContent>
        {orders.length === 0 ? (
          <p className="text-sm text-muted-foreground">No orders yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {orders.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/account/orders/${order.id}`}
                  className="flex items-center justify-between gap-4 rounded-lg border border-border p-3 text-sm hover:border-foreground/30"
                >
                  <span className="flex flex-col">
                    <span className="font-medium">{order.order_number}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(order.created_at).toLocaleDateString("en-GB")}
                    </span>
                  </span>
                  <span className="flex flex-col items-end">
                    <span>{formatPrice(order.total_amount, order.currency)}</span>
                    <span className="text-xs text-muted-foreground">
                      {STATUS_LABELS[order.status] ?? order.status}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
