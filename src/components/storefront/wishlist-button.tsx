"use client";

import { Heart } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { toggleWishlist } from "@/features/wishlist/actions";

export function WishlistButton({
  productId,
  initiallyWishlisted,
  isSignedIn,
}: {
  productId: string;
  initiallyWishlisted: boolean;
  isSignedIn: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [wishlisted, setWishlisted] = useState(initiallyWishlisted);
  const router = useRouter();

  function handleClick() {
    if (!isSignedIn) {
      router.push("/login?next=/products");
      return;
    }
    startTransition(async () => {
      const result = await toggleWishlist(productId);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        setWishlisted((prev) => !prev);
      }
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      disabled={isPending}
      onClick={handleClick}
      aria-pressed={wishlisted}
    >
      <Heart className="size-4" fill={wishlisted ? "currentColor" : "none"} />
      {wishlisted ? "Saved" : "Save to Wishlist"}
    </Button>
  );
}
