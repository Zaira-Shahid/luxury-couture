"use client";

import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { removeCartItem, updateCartItemQuantity } from "@/features/cart/actions";
import type { EnrichedCartItem } from "@/lib/cart/get-cart";

function formatPrice(amount: number, currency: string) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
}

export function CartItemRow({ item }: { item: EnrichedCartItem }) {
  const [isPending, startTransition] = useTransition();

  function handleQuantityChange(quantity: number) {
    if (quantity < 1) return;
    startTransition(async () => {
      const result = await updateCartItemQuantity(item.id, quantity);
      if ("error" in result) toast.error(result.error);
    });
  }

  function handleRemove() {
    startTransition(async () => {
      const result = await removeCartItem(item.id);
      if ("error" in result) toast.error(result.error);
    });
  }

  const name = item.product?.name ?? item.builderConfigLabel ?? "Item";
  const href = item.product ? `/products/${item.product.slug}` : null;
  const currency = item.product?.currency ?? "GBP";

  return (
    <div className="flex items-center gap-4 border-b border-border py-4 last:border-0">
      <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
        {item.product?.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.product.image_url} alt={name} className="size-full object-cover" />
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        {href ? (
          <Link href={href} className="text-sm font-medium hover:underline">
            {name}
          </Link>
        ) : (
          <p className="text-sm font-medium">{name}</p>
        )}
        <p className="text-sm text-muted-foreground">{formatPrice(item.unit_price_snapshot, currency)}</p>
        <div className="mt-2 flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            disabled={isPending || item.quantity <= 1}
            onClick={() => handleQuantityChange(item.quantity - 1)}
          >
            −
          </Button>
          <span className="w-6 text-center text-sm">{item.quantity}</span>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            disabled={isPending}
            onClick={() => handleQuantityChange(item.quantity + 1)}
          >
            +
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled={isPending} onClick={handleRemove}>
            Remove
          </Button>
        </div>
      </div>
      <p className="text-sm font-medium">
        {formatPrice(item.unit_price_snapshot * item.quantity, currency)}
      </p>
    </div>
  );
}
