import type { Metadata } from "next";

import { getAdminPayments } from "@/lib/payments/get-payments";

import { PaymentRowActions } from "./payment-row-actions";

export const metadata: Metadata = { title: "Payments" };

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  succeeded: "Succeeded",
  failed: "Failed",
  refunded: "Refunded",
};

const TYPE_LABELS: Record<string, string> = {
  deposit: "Deposit",
  balance: "Balance",
  full: "Full",
  refund: "Refund",
};

function formatPrice(amount: number, currency: string) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
}

export default async function AdminPaymentsPage() {
  const payments = await getAdminPayments();

  return (
    <div className="container py-10">
      <h1 className="mb-6 font-heading text-2xl">Payments</h1>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-2">Order</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Amount</th>
              <th className="px-4 py-2">Provider</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                  No payments found.
                </td>
              </tr>
            ) : (
              payments.map((payment) => (
                <tr key={payment.id} className="border-t border-border">
                  <td className="px-4 py-2">{payment.orders?.order_number ?? "—"}</td>
                  <td className="px-4 py-2">{TYPE_LABELS[payment.type] ?? payment.type}</td>
                  <td className="px-4 py-2">{formatPrice(payment.amount, payment.currency)}</td>
                  <td className="px-4 py-2 text-muted-foreground">{payment.provider}</td>
                  <td className="px-4 py-2">{STATUS_LABELS[payment.status] ?? payment.status}</td>
                  <td className="px-4 py-2">
                    <PaymentRowActions paymentId={payment.id} status={payment.status} />
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
