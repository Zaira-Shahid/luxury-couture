"use client";

import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { StorefrontImage } from "@/components/shared/storefront-image";
import { removeCartItem, updateCartItemQuantity } from "@/features/cart/actions";
import type { EnrichedCartItem } from "@/lib/cart/get-cart";

import { formatMoney } from "@/lib/settings/format";

export function CartItemRow({
  item,
  currency,
  locale,
}: {
  item: EnrichedCartItem;
  /**
   * Passed down from the page rather than read from the product row:
   * the cart TOTAL is rendered in the shop's configured currency
   * (Module 25), so the line items must match it. Showing a line in one
   * currency and the total in another is worse than either alone.
   */
  currency: string;
  locale: string;
}) {
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

  return (
    <div className="flex items-center gap-4 border-b border-border py-4 last:border-0">
      {/*
        MODULE 28: was a raw <img>. `relative` is required because
        StorefrontImage uses next/image's `fill`.

        `sizes` is the substantive part: without it next/image assumes
        100vw and serves a full-width source for a 64px thumbnail, which
        on a cart of six items is several megabytes to render a strip of
        postage stamps.
      */}
      <div className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
        {item.product?.image_url ? (
          <StorefrontImage
            src={item.product.image_url}
            alt={name}
            sizes="64px"
            className="object-cover"
          />
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
        <p className="text-sm text-muted-foreground">{formatMoney(item.unit_price_snapshot, currency, locale)}</p>
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
        {formatMoney(item.unit_price_snapshot * item.quantity, currency, locale)}
      </p>
    </div>
  );
}
