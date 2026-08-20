import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { siteConfig } from "@/lib/config/site";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Receipt" };

const TYPE_LABELS: Record<string, string> = {
  deposit: "Deposit",
  balance: "Balance payment",
  full: "Full payment",
  refund: "Refund",
};

function formatPrice(amount: number, currency: string) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
}

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  // RLS (owner-or-admin) scopes this to the caller's own payment.
  const { data: payment } = await supabase
    .from("payments")
    .select("*, orders(order_number)")
    .eq("id", id)
    .single();

  if (!payment || payment.status !== "succeeded") notFound();

  const orderNumber = (payment.orders as { order_number: string } | null)?.order_number ?? "—";

  return (
    <div className="mx-auto max-w-md rounded-xl bg-card p-8 ring-1 ring-foreground/10 print:ring-0">
      <p className="font-heading text-xl">{siteConfig.name}</p>
      <p className="mt-1 text-sm text-muted-foreground">Payment Receipt</p>

      <div className="mt-6 flex flex-col gap-2 border-t border-border pt-6 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Order</span>
          <span>{orderNumber}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Type</span>
          <span>{TYPE_LABELS[payment.type] ?? payment.type}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Date</span>
          <span>{payment.paid_at ? new Date(payment.paid_at).toLocaleDateString("en-GB") : "—"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Reference</span>
          <span className="max-w-[60%] truncate text-right">{payment.provider_reference ?? "—"}</span>
        </div>
        <div className="mt-2 flex justify-between border-t border-border pt-2 font-medium">
          <span>Amount</span>
          <span>{formatPrice(payment.amount, payment.currency)}</span>
        </div>
      </div>
    </div>
  );
}
