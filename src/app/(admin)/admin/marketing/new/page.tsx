import type { Metadata } from "next";

import { createCoupon } from "@/features/admin-coupons/actions";

import { CouponForm } from "../coupon-form";

export const metadata: Metadata = { title: "New Coupon" };

export default function NewCouponPage() {
  return (
    <div className="container max-w-2xl py-10">
      <h1 className="mb-6 font-heading text-2xl">New Coupon</h1>
      <CouponForm action={createCoupon} />
    </div>
  );
}
