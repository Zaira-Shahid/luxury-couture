import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getProfile } from "@/lib/auth/session";
import { getOrderDetail } from "@/lib/orders/get-orders";

import { ReviewForm } from "./review-form";

export const metadata: Metadata = { title: "Leave a Review" };

export default async function NewReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>;
}) {
  const { orderId } = await searchParams;
  if (!orderId) notFound();

  const [detail, profile] = await Promise.all([getOrderDetail(orderId), getProfile()]);
  if (!detail) notFound();
  if (detail.shipping?.status !== "delivered") {
    redirect(`/account/orders/${orderId}`);
  }

  const products = detail.items
    .filter((item) => item.product_id)
    .map((item) => ({ id: item.product_id as string, name: item.description_snapshot }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Leave a Review</CardTitle>
        <CardDescription>Order {detail.order.order_number}</CardDescription>
      </CardHeader>
      <CardContent>
        <ReviewForm
          orderId={orderId}
          orderNumber={detail.order.order_number}
          products={products}
          defaultReviewerName={profile?.full_name ?? ""}
        />
      </CardContent>
    </Card>
  );
}
