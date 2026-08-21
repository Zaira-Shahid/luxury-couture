import type { Metadata } from "next";

import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = { title: "Reviews" };

export default function AdminReviewsPage() {
  return (
    <div className="container py-10">
      <ComingSoon
        title="Reviews & Testimonials"
        description="Moderate and feature customer reviews — Module 18."
      />
    </div>
  );
}
