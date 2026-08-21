import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardStats } from "@/lib/admin/get-dashboard-stats";

export const metadata: Metadata = { title: "Admin" };

function formatPrice(amount: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(amount);
}

function StatCard({
  title,
  value,
  description,
  href,
}: {
  title: string;
  value: string;
  description?: string;
  href?: string;
}) {
  const content = (
    <Card className="h-full transition-colors hover:border-foreground/20">
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl font-heading">{value}</CardTitle>
      </CardHeader>
      {description ? (
        <CardContent>
          <p className="text-xs text-muted-foreground">{description}</p>
        </CardContent>
      ) : null}
    </Card>
  );
  return href ? (
    <Link href={href} className="block">
      {content}
    </Link>
  ) : (
    content
  );
}

export default async function AdminHomePage() {
  const stats = await getDashboardStats();

  const weekDelta = stats.ordersLastWeek > 0
    ? Math.round(((stats.ordersThisWeek - stats.ordersLastWeek) / stats.ordersLastWeek) * 100)
    : null;

  return (
    <div className="container flex flex-col gap-6 py-10">
      <div>
        <h1 className="font-heading text-2xl">Dashboard</h1>
        <p className="text-sm text-muted-foreground">An overview of the business right now.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Revenue (all time)"
          value={formatPrice(stats.revenueAllTime)}
          description={`${formatPrice(stats.revenueThisMonth)} this month`}
        />
        <StatCard
          title="Orders"
          value={String(stats.ordersTotal)}
          description={`${stats.ordersPending} pending`}
          href="/admin/orders"
        />
        <StatCard title="Customers" value={String(stats.customersTotal)} href="/admin/customers" />
        <StatCard
          title="Pending enquiries"
          value={String(stats.enquiriesPending)}
          href="/admin/enquiries"
        />
        <StatCard
          title="Active production"
          value={String(stats.productionActive)}
          description="Orders not yet delivered"
          href="/admin/production"
        />
        <StatCard
          title="Pending payments"
          value={String(stats.paymentsPendingCount)}
          description={formatPrice(stats.paymentsPendingAmount)}
          href="/admin/payments"
        />
        <StatCard
          title="Shipping in transit"
          value={String(stats.shippingInTransit)}
          href="/admin/shipping"
        />
        <StatCard
          title="Reviews"
          value={String(stats.reviewsTotal)}
          description={
            stats.reviewsTotal === 0
              ? "No reviews yet"
              : `${stats.reviewsPendingModeration} awaiting moderation`
          }
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">This week</CardTitle>
          <CardDescription>
            {stats.ordersThisWeek} orders this week vs. {stats.ordersLastWeek} last week
            {weekDelta !== null ? ` (${weekDelta >= 0 ? "+" : ""}${weekDelta}%)` : ""}
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
