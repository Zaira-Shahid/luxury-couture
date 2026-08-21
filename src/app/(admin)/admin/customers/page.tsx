import type { Metadata } from "next";
import Link from "next/link";

import { computeSegments, SEGMENT_LABELS, type SegmentKey } from "@/lib/admin/customer-segments";
import { getAdminCustomers } from "@/lib/admin/get-customers";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Customers" };

function formatPrice(amount: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(amount);
}

const SEGMENT_KEYS = Object.keys(SEGMENT_LABELS) as SegmentKey[];

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ segment?: string }>;
}) {
  const { segment } = await searchParams;
  const allCustomers = await getAdminCustomers();
  const withSegments = allCustomers.map((customer) => ({ customer, tags: computeSegments(customer) }));
  const activeSegment = SEGMENT_KEYS.includes(segment as SegmentKey) ? (segment as SegmentKey) : null;
  const filtered = activeSegment ? withSegments.filter((row) => row.tags.includes(activeSegment)) : withSegments;

  return (
    <div className="container py-10">
      <h1 className="mb-6 font-heading text-2xl">Customers</h1>

      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href="/admin/customers"
          className={cn(
            "rounded-full border px-3 py-1 text-xs",
            !activeSegment ? "border-primary bg-primary/10" : "border-border text-muted-foreground"
          )}
        >
          All ({allCustomers.length})
        </Link>
        {SEGMENT_KEYS.map((key) => (
          <Link
            key={key}
            href={`/admin/customers?segment=${key}`}
            className={cn(
              "rounded-full border px-3 py-1 text-xs",
              activeSegment === key ? "border-primary bg-primary/10" : "border-border text-muted-foreground"
            )}
          >
            {SEGMENT_LABELS[key]} ({withSegments.filter((row) => row.tags.includes(key)).length})
          </Link>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Segment</th>
              <th className="px-4 py-2">Orders</th>
              <th className="px-4 py-2">Lifetime spend</th>
              <th className="px-4 py-2">Joined</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  No customers found.
                </td>
              </tr>
            ) : (
              filtered.map(({ customer, tags }) => (
                <tr key={customer.id} className="border-t border-border">
                  <td className="px-4 py-2">
                    <Link href={`/admin/customers/${customer.id}`} className="hover:underline">
                      {customer.full_name ?? "Unnamed customer"}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {tags.length > 0 ? tags.map((t) => SEGMENT_LABELS[t]).join(", ") : "—"}
                  </td>
                  <td className="px-4 py-2">{customer.orderCount}</td>
                  <td className="px-4 py-2">{formatPrice(customer.lifetimeSpend)}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {new Date(customer.created_at).toLocaleDateString("en-GB")}
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
