"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { removeFromWishlist } from "@/features/wishlist/actions";

export function RemoveWishlistButton({ itemId }: { itemId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await removeFromWishlist(itemId);
          if ("error" in result) toast.error(result.error);
        })
      }
    >
      {isPending ? "Removing…" : "Remove"}
    </Button>
  );
}
