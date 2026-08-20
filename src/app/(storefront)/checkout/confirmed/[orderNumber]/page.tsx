import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Order Confirmed" };

function formatPrice(amount: number, currency: string) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
}

export default async function OrderConfirmedPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  const supabase = await createClient();
  // RLS (owner-or-admin) already scopes this to the signed-in customer's
  // own order — no extra filter needed.
  const { data: order } = await supabase
    .from("orders")
    .select("order_number, total_amount, currency, status")
    .eq("order_number", orderNumber)
    .single();

  if (!order) notFound();

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
          <p className="text-xs text-muted-foreground">
            We&apos;ll be in touch to arrange payment and confirm next steps.
          </p>
          <Button render={<Link href="/" />} className="mt-4 w-fit self-center">
            Continue Shopping
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
