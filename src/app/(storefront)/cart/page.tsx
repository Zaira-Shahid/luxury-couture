import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCart } from "@/lib/cart/get-cart";

import { CartItemRow } from "./cart-item-row";

export const metadata: Metadata = { title: "Cart" };

function formatPrice(amount: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(amount);
}

export default async function CartPage() {
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
              <CartItemRow key={item.id} item={item} />
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
