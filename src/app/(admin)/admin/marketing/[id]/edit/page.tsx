import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { updateCoupon } from "@/features/admin-coupons/actions";
import { getAdminCoupon } from "@/lib/admin/get-coupons";

import { CouponForm } from "../../coupon-form";

export const metadata: Metadata = { title: "Edit Coupon" };

export default async function EditCouponPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const coupon = await getAdminCoupon(id);
  if (!coupon) notFound();

  return (
    <div className="container max-w-2xl py-10">
      <h1 className="mb-6 font-heading text-2xl">Edit Coupon</h1>
      <CouponForm key={`${coupon.id}-${coupon.updated_at}`} coupon={coupon} action={updateCoupon.bind(null, id)} />
    </div>
  );
}
