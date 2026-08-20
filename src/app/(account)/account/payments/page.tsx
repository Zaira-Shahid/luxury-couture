import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getMyPayments } from "@/lib/payments/get-payments";

export const metadata: Metadata = { title: "Payments" };

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  succeeded: "Paid",
  failed: "Failed",
  refunded: "Refunded",
};

const TYPE_LABELS: Record<string, string> = {
  deposit: "Deposit",
  balance: "Balance",
  full: "Payment",
  refund: "Refund",
};

function formatPrice(amount: number, currency: string) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
}

export default async function PaymentsPage() {
  const payments = await getMyPayments();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payments</CardTitle>
        <CardDescription>Your payment history and receipts.</CardDescription>
      </CardHeader>
      <CardContent>
        {payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payments yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {payments.map((payment) => (
              <li
                key={payment.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-border p-3 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {TYPE_LABELS[payment.type] ?? payment.type} — {formatPrice(payment.amount, payment.currency)}
                  </p>
                  <p className="text-muted-foreground">
                    Order {payment.orders?.order_number ?? "—"} · {STATUS_LABELS[payment.status] ?? payment.status}
                  </p>
                </div>
                {payment.status === "succeeded" ? (
                  <Link
                    href={`/account/payments/${payment.id}/receipt`}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    Receipt
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
