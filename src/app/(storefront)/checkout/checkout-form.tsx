"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { previewCoupon } from "@/features/coupons/actions";
import { placeOrder } from "@/features/checkout/actions";
import { pointsToPounds } from "@/lib/loyalty/config";
import type { Address, MeasurementProfile } from "@/types/database";

function formatPrice(amount: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(amount);
}

export function CheckoutForm({
  addresses,
  measurementProfiles,
  requiresMeasurements,
  estimatedSubtotal,
  loyaltyPointsBalance,
}: {
  addresses: Address[];
  measurementProfiles: MeasurementProfile[];
  requiresMeasurements: boolean;
  estimatedSubtotal: number;
  loyaltyPointsBalance: number;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [couponPreview, setCouponPreview] = useState<{ discount: number } | { error: string } | null>(null);
  const [isPreviewing, startPreviewing] = useTransition();

  function handleApplyCoupon() {
    setCouponPreview(null);
    startPreviewing(async () => {
      const result = await previewCoupon(couponCode, estimatedSubtotal);
      if ("error" in result) setCouponPreview({ error: result.error });
      else setCouponPreview({ discount: result.data.discount });
    });
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await placeOrder(formData);
      // placeOrder redirects on success — reaching here means an error.
      if (result && "error" in result) setError(result.error);
    });
  }

  if (addresses.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Add a shipping address to your account before checking out.
      </p>
    );
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-medium">Shipping address</p>
        <div className="flex flex-col gap-2">
          {addresses.map((address) => (
            <label
              key={address.id}
              className="flex cursor-pointer items-start gap-2 rounded-lg border border-border p-3 text-sm has-[:checked]:border-primary"
            >
              <input type="radio" name="addressId" value={address.id} defaultChecked={address.is_default} required />
              <span>
                {address.recipient_name} — {address.line1}, {address.city}, {address.postal_code}
              </span>
            </label>
          ))}
        </div>
      </div>

      {requiresMeasurements ? (
        <div>
          <p className="mb-2 text-sm font-medium">Measurement profile</p>
          {measurementProfiles.length === 0 ? (
            <p className="text-sm text-destructive">
              Add a measurement profile to your account before checking out with a custom design.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {measurementProfiles.map((profile) => (
                <label
                  key={profile.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-3 text-sm has-[:checked]:border-primary"
                >
                  <input type="radio" name="measurementProfileId" value={profile.id} required />
                  <span>{profile.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      ) : null}

      <div>
        <p className="mb-2 text-sm font-medium">Coupon code (optional)</p>
        <div className="flex gap-2">
          <Input
            name="couponCode"
            value={couponCode}
            onChange={(e) => {
              setCouponCode(e.target.value);
              setCouponPreview(null);
            }}
            placeholder="Enter a code"
            className="flex-1 uppercase"
          />
          <Button type="button" variant="outline" size="sm" disabled={isPreviewing || !couponCode} onClick={handleApplyCoupon}>
            {isPreviewing ? "Checking…" : "Apply"}
          </Button>
        </div>
        {couponPreview ? (
          "error" in couponPreview ? (
            <p className="mt-1 text-xs text-destructive">{couponPreview.error}</p>
          ) : (
            <p className="mt-1 text-xs text-primary">
              {formatPrice(couponPreview.discount)} off will be applied at checkout.
            </p>
          )
        ) : null}
      </div>

      {loyaltyPointsBalance > 0 ? (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="redeemPoints" className="size-4" />
          Redeem my {loyaltyPointsBalance} loyalty points (up to {formatPrice(pointsToPounds(loyaltyPointsBalance))} off)
        </label>
      ) : null}

      <div>
        <p className="mb-2 text-sm font-medium">Notes (optional)</p>
        <Textarea name="notes" rows={3} />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Placing order…" : "Place Order"}
      </Button>
    </form>
  );
}
