"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { addProductToCart } from "@/features/cart/actions";

export function AddToCartButton({ productId }: { productId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await addProductToCart(productId);
      if ("error" in result) toast.error(result.error);
      else toast.success("Added to cart.");
    });
  }

  return (
    <Button type="button" disabled={isPending} onClick={handleClick}>
      {isPending ? "Adding…" : "Add to Cart"}
    </Button>
  );
}
