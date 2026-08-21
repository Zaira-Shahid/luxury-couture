import type { Metadata } from "next";
import Link from "next/link";

import { DeleteButton } from "@/components/admin/delete-button";
import { Button } from "@/components/ui/button";
import { deleteCoupon } from "@/features/admin-coupons/actions";
import { getAdminCoupons } from "@/lib/admin/get-coupons";

export const metadata: Metadata = { title: "Marketing" };

function formatValue(coupon: { type: string; value: number }) {
  return coupon.type === "percentage" ? `${coupon.value}%` : `£${coupon.value.toFixed(2)}`;
}

export default async function AdminMarketingPage() {
  const coupons = await getAdminCoupons();

  return (
    <div className="container py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-heading text-2xl">Marketing</h1>
        <Button render={<Link href="/admin/marketing/new" />}>New Coupon</Button>
      </div>

      {coupons.length === 0 ? (
        <p className="text-sm text-muted-foreground">No coupons yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Code</th>
                <th className="px-4 py-2 font-medium">Value</th>
                <th className="px-4 py-2 font-medium">Uses</th>
                <th className="px-4 py-2 font-medium">Active</th>
                <th className="px-4 py-2 font-medium">Expires</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((coupon) => (
                <tr key={coupon.id} className="border-t border-border">
                  <td className="px-4 py-2">
                    <Link href={`/admin/marketing/${coupon.id}/edit`} className="hover:underline">
                      {coupon.code}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{formatValue(coupon)}</td>
                  <td className="px-4 py-2">
                    {coupon.used_count}
                    {coupon.max_uses ? ` / ${coupon.max_uses}` : ""}
                  </td>
                  <td className="px-4 py-2">{coupon.is_active ? "Yes" : "—"}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {coupon.expires_at ? new Date(coupon.expires_at).toLocaleDateString("en-GB") : "—"}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <DeleteButton action={deleteCoupon.bind(null, coupon.id)} confirmMessage="Delete this coupon?" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
