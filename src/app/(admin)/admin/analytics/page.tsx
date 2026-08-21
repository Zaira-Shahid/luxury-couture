import type { Metadata } from "next";
import Link from "next/link";

import { FunnelChart, FunnelTrends } from "@/components/admin/analytics-charts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  buildFunnel,
  getEventSummary,
  getRecentEvents,
  getTimeseries,
  getTopViewedProducts,
  resolveRange,
} from "@/lib/admin/get-analytics";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Analytics" };

const RANGES = [7, 30, 90];

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-GB").format(value);
}

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { days } = await searchParams;
  const range = resolveRange(days);

  const [summary, timeseries, topProducts, recent] = await Promise.all([
    getEventSummary(range),
    getTimeseries(range),
    getTopViewedProducts(range),
    getRecentEvents(),
  ]);

  const funnel = buildFunnel(summary);
  const totalEvents = summary.reduce((sum, row) => sum + Number(row.total_events), 0);

  return (
    <div className="container flex flex-col gap-10 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl">Analytics</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Visitor behaviour from this site&apos;s own first-party tracking. Revenue, orders and
            production figures live on the{" "}
            <Link href="/admin" className="underline hover:text-foreground">
              Dashboard
            </Link>
            .
          </p>
        </div>
        <nav aria-label="Date range" className="flex gap-1 text-sm">
          {RANGES.map((option) => (
            <Link
              key={option}
              href={`/admin/analytics?days=${option}`}
              className={cn(
                "rounded-lg border px-3 py-1.5 transition-colors",
                range.days === option
                  ? "border-foreground/20 bg-muted font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {option}d
            </Link>
          ))}
        </nav>
      </div>

      {totalEvents === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">No events recorded yet</CardTitle>
            <CardDescription>
              Events are only collected from visitors who accept analytics cookies. If the site is
              live and this stays empty, check that the consent banner is appearing on the
              storefront.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <section>
            <h2 className="mb-1 font-heading text-xl">Conversion funnel</h2>
            <p className="mb-5 text-sm text-muted-foreground">
              Counted by distinct session, so one visitor browsing ten products counts once.
            </p>
            <Card>
              <CardContent className="pt-6">
                <FunnelChart steps={funnel} />
              </CardContent>
            </Card>
          </section>

          <section>
            <h2 className="mb-1 font-heading text-xl">Trends</h2>
            <p className="mb-5 text-sm text-muted-foreground">
              Each step on its own scale — product views outnumber purchases by an order of
              magnitude, so a shared axis would flatten the ones that matter most.
            </p>
            <FunnelTrends rows={timeseries} days={range.days} />
          </section>

          <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <h2 className="mb-4 font-heading text-xl">Most viewed products</h2>
              {topProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No product views in this period.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2 font-medium">Product</th>
                        <th className="px-4 py-2 text-right font-medium">Views</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topProducts.map((product) => (
                        <tr key={product.product_id} className="border-t border-border">
                          <td className="px-4 py-2">
                            <Link
                              href={`/products/${product.product_slug}`}
                              className="hover:underline"
                            >
                              {product.product_name}
                            </Link>
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums">
                            {formatNumber(Number(product.views))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <h2 className="mb-4 font-heading text-xl">All events</h2>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 font-medium">Event</th>
                      <th className="px-4 py-2 text-right font-medium">Total</th>
                      <th className="px-4 py-2 text-right font-medium">Sessions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.map((row) => (
                      <tr key={row.event_name} className="border-t border-border">
                        <td className="px-4 py-2 font-mono text-xs">{row.event_name}</td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {formatNumber(Number(row.total_events))}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                          {formatNumber(Number(row.unique_sessions))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section>
            <h2 className="mb-4 font-heading text-xl">Recent activity</h2>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">When</th>
                    <th className="px-4 py-2 font-medium">Event</th>
                    <th className="px-4 py-2 font-medium">Signed in</th>
                    <th className="px-4 py-2 font-medium">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((event) => (
                    <tr key={event.id} className="border-t border-border">
                      <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">
                        {new Date(event.occurred_at).toLocaleString("en-GB")}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs">{event.event_name}</td>
                      <td className="px-4 py-2">{event.profile_id ? "Yes" : "—"}</td>
                      <td className="max-w-md truncate px-4 py-2 font-mono text-xs text-muted-foreground">
                        {event.properties ? JSON.stringify(event.properties) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <p className="text-xs text-muted-foreground">
        Raw events are automatically deleted after 14 months. Only visitors who accepted analytics
        cookies are measured, so these figures undercount total traffic by design.
      </p>
    </div>
  );
}
