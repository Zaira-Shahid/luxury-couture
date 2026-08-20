import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { isStripeConfigured } from "@/lib/payments";

import { PayNowButton } from "./pay-now-button";

export const metadata: Metadata = { title: "Order Confirmed" };

const TYPE_LABELS: Record<string, string> = {
  deposit: "Deposit",
  balance: "Balance",
  full: "Payment",
  refund: "Refund",
};

function formatPrice(amount: number, currency: string) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
}

export default async function OrderConfirmedPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ payment?: string }>;
}) {
  const { orderNumber } = await params;
  const { payment: paymentRedirect } = await searchParams;
  const supabase = await createClient();
  // RLS (owner-or-admin) already scopes this to the signed-in customer's
  // own order — no extra filter needed.
  const { data: order } = await supabase
    .from("orders")
    .select("id, order_number, total_amount, currency, status")
    .eq("order_number", orderNumber)
    .single();

  if (!order) notFound();

  const { data: payments } = await supabase
    .from("payments")
    .select("id, type, amount, status")
    .eq("order_id", order.id)
    .order("created_at");

  const pendingPayments = (payments ?? []).filter((p) => p.status === "pending");

  return (
    <div className="container flex max-w-lg flex-col items-center py-24 text-center">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Order Confirmed</CardTitle>
          <CardDescription>Thank you — we&apos;ve received your order.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">Order number</p>
          <p className="font-heading text-2xl">{order.order_number}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Total: {formatPrice(order.total_amount, order.currency)}
          </p>

          {paymentRedirect === "success" ? (
            <p className="mt-2 rounded-lg bg-secondary/50 p-3 text-sm">
              Thank you — we&apos;re confirming your payment now. This page will reflect it shortly.
            </p>
          ) : null}

          {pendingPayments.length > 0 ? (
            <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 text-left">
              {pendingPayments.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3">
                  <span className="text-sm">
                    {TYPE_LABELS[p.type] ?? p.type} due: {formatPrice(p.amount, order.currency)}
                  </span>
                  {isStripeConfigured() ? (
                    <PayNowButton paymentId={p.id} />
                  ) : (
                    <span className="text-xs text-muted-foreground">We&apos;ll contact you to arrange payment.</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              We&apos;ll be in touch to confirm next steps.
            </p>
          )}

          <Button render={<Link href="/" />} className="mt-4 w-fit self-center">
            Continue Shopping
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
