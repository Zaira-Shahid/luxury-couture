import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getWishlistItems } from "@/lib/wishlist/get-wishlist";

import { RemoveWishlistButton } from "./remove-wishlist-button";

export const metadata: Metadata = { title: "Wishlist" };

function formatPrice(amount: number, currency: string) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
}

export default async function WishlistPage() {
  const items = await getWishlistItems();

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h1">Wishlist</CardTitle>
        <CardDescription>Pieces you&apos;ve saved for later.</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing saved yet.{" "}
            <Link href="/products" className="text-primary underline-offset-4 hover:underline">
              Browse the shop
            </Link>
            .
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-border p-3"
              >
                <Link href={`/products/${item.product.slug}`} className="text-sm">
                  <p className="font-medium">{item.product.name}</p>
                  <p className="text-muted-foreground">
                    {formatPrice(item.product.base_price, item.product.currency)}
                  </p>
                </Link>
                <RemoveWishlistButton itemId={item.id} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
