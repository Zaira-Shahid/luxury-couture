import type { Metadata } from "next";

import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = { title: "Inventory" };

export default function AdminInventoryPage() {
  return (
    <div className="container py-10">
      <ComingSoon
        title="Inventory Management"
        description="Stock, reserved quantity, and low-stock tracking for fabrics and materials — Module 17."
      />
    </div>
  );
}
