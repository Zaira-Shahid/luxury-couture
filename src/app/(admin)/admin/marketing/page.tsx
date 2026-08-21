import type { Metadata } from "next";

import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = { title: "Marketing" };

export default function AdminMarketingPage() {
  return (
    <div className="container py-10">
      <ComingSoon
        title="Marketing & Customer Retention"
        description="Discounts, promotions, and loyalty tools — Module 19."
      />
    </div>
  );
}
