import type { Metadata } from "next";

import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = { title: "Wishlist" };

export default function WishlistPage() {
  return <ComingSoon title="Wishlist" description="Pieces you've saved for later." />;
}
