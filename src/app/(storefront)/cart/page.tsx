import type { Metadata } from "next";
import Link from "next/link";
import { getMoneyFormatter } from "@/lib/settings/get-money-formatter";


import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCart } from "@/lib/cart/get-cart";

import { CartItemRow } from "./cart-item-row";

export const metadata: Metadata = { title: "Cart" };

export default async function CartPage() {
  // Module 25: currency and locale come from Admin -> Settings.
  const { format: formatPrice, currency, locale } = await getMoneyFormatter();
  const { items } = await getCart();
  const total = items.reduce((sum, item) => sum + item.unit_price_snapshot * item.quantity, 0);

  return (
    <div className="container max-w-2xl py-16">
      <h1 className="mb-6 font-heading text-2xl">Your Cart</h1>

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm text-muted-foreground">Your cart is empty.</p>
            <Button render={<Link href="/products" />} className="mt-4">
              Browse Products
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Items</CardTitle>
          </CardHeader>
          <CardContent>
            {items.map((item) => (
              <CartItemRow key={item.id} item={item} currency={currency} locale={locale} />
            ))}
            <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
              <p className="font-medium">Estimated total</p>
              <p className="font-medium">{formatPrice(total)}</p>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Final pricing is confirmed at checkout.
            </p>
            <Button render={<Link href="/checkout" />} className="mt-6 w-full">
              Proceed to Checkout
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
