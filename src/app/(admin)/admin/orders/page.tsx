import type { Metadata } from "next";
import Link from "next/link";

import { getAdminOrders } from "@/lib/orders/get-orders";

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

export default async function AdminOrdersPage() {
  const orders = await getAdminOrders();

  return (
    <div className="container py-10">
      <h1 className="mb-6 font-heading text-2xl">Orders</h1>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-2">Order</th>
              <th className="px-4 py-2">Customer</th>
              <th className="px-4 py-2">Total</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Placed</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  No orders found.
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id} className="border-t border-border">
                  <td className="px-4 py-2">
                    <Link href={`/admin/orders/${order.id}`} className="hover:underline">
                      {order.order_number}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{order.profiles?.full_name ?? "—"}</td>
                  <td className="px-4 py-2">{formatPrice(order.total_amount, order.currency)}</td>
                  <td className="px-4 py-2">{STATUS_LABELS[order.status] ?? order.status}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {new Date(order.created_at).toLocaleDateString("en-GB")}
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
