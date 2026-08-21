import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { EventTracker } from "@/components/analytics/event-tracker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAuthUser } from "@/lib/auth/session";
import { getCart } from "@/lib/cart/get-cart";
import { getMyLoyaltyAccount } from "@/lib/loyalty/get-loyalty";
import { createClient } from "@/lib/supabase/server";
import type { Address, MeasurementProfile } from "@/types/database";

import { CheckoutForm } from "./checkout-form";

export const metadata: Metadata = { title: "Checkout" };

function formatPrice(amount: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(amount);
}

export default async function CheckoutPage() {
  // Orders require an account (orders.customer_id is not-null by design,
  // per Module 1's own "all writes happen server-side once validated"
  // intent) — checkout can't proceed as a guest, unlike the cart itself.
  const user = await getAuthUser();
  if (!user) redirect("/login?next=/checkout");

  const { items } = await getCart();
  if (items.length === 0) redirect("/cart");

  const supabase = await createClient();
  const [{ data: addresses }, { data: measurementProfiles }, { account: loyaltyAccount }] = await Promise.all([
    supabase.from("addresses").select("*").eq("customer_id", user.id).order("is_default", { ascending: false }),
    supabase.from("measurement_profiles").select("*").eq("customer_id", user.id),
    getMyLoyaltyAccount(),
  ]);

  const requiresMeasurements = items.some((item) => item.builder_configuration_id);
  const total = items.reduce((sum, item) => sum + item.unit_price_snapshot * item.quantity, 0);

  return (
    <div className="container max-w-2xl py-16">
      <EventTracker event="checkout_started" properties={{ value: total, itemCount: items.length }} />
      <h1 className="mb-6 font-heading text-2xl">Checkout</h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Order Summary</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm">
          {items.map((item) => (
            <div key={item.id} className="flex justify-between">
              <span>
                {item.product?.name ?? item.builderConfigLabel} × {item.quantity}
              </span>
              <span>{formatPrice(item.unit_price_snapshot * item.quantity)}</span>
            </div>
          ))}
          <div className="mt-2 flex justify-between border-t border-border pt-2 font-medium">
            <span>Estimated total</span>
            <span>{formatPrice(total)}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <CheckoutForm
            addresses={(addresses ?? []) as Address[]}
            measurementProfiles={(measurementProfiles ?? []) as MeasurementProfile[]}
            requiresMeasurements={requiresMeasurements}
            estimatedSubtotal={total}
            loyaltyPointsBalance={loyaltyAccount?.points_balance ?? 0}
          />
        </CardContent>
      </Card>
    </div>
  );
}
